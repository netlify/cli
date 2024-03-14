import { readFile } from 'fs/promises'
import { join } from 'path'
import { fileURLToPath } from 'url'

import type { Declaration, EdgeFunction, FunctionConfig, Manifest, ModuleGraph } from '@netlify/edge-bundler'

import BaseCommand from '../../commands/base-command.js'
import {
  NETLIFYDEVERR,
  NETLIFYDEVLOG,
  NETLIFYDEVWARN,
  nonNullable,
  chalk,
  log,
  warn,
  watchDebounced,
  isNodeError,
} from '../../utils/command-helpers.js'
import type { FeatureFlags } from '../../utils/feature-flags.js'
import { MultiMap } from '../../utils/multimap.js'

import { INTERNAL_EDGE_FUNCTIONS_FOLDER } from './consts.js'

//  TODO: Replace with a proper type for the entire config object.
export interface Config {
  edge_functions?: Declaration[]
  [key: string]: unknown
}
type EdgeFunctionEvent = 'buildError' | 'loaded' | 'reloaded' | 'reloading' | 'removed'
type Route = Omit<Manifest['routes'][0], 'pattern'> & { pattern: RegExp }
type RunIsolate = Awaited<ReturnType<typeof import('@netlify/edge-bundler').serve>>

type ModuleJson = ModuleGraph['modules'][number]

interface EdgeFunctionsRegistryOptions {
  command: BaseCommand
  bundler: typeof import('@netlify/edge-bundler')
  config: Config
  configPath: string
  debug: boolean
  directories: string[]
  env: Record<string, { sources: string[]; value: string }>
  featureFlags: FeatureFlags
  getUpdatedConfig: () => Promise<Config>
  projectDir: string
  runIsolate: RunIsolate
  servePath: string
  importMapFromTOML?: string
}

/**
 * Helper method which, given a edge bundler graph module and an index of modules by path, traverses its dependency tree
 * and returns an array of all of ist local dependencies
 */
function traverseLocalDependencies(
  { dependencies = [] }: ModuleJson,
  modulesByPath: Map<string, ModuleJson>,
): string[] {
  return dependencies.flatMap((dependency) => {
    // We're interested in tracking local dependencies, so we only look at
    // specifiers with the `file:` protocol.
    if (
      dependency.code === undefined ||
      typeof dependency.code.specifier !== 'string' ||
      !dependency.code.specifier.startsWith('file://')
    ) {
      return []
    }
    const { specifier: dependencyURL } = dependency.code
    const dependencyPath = fileURLToPath(dependencyURL)
    const dependencyModule = modulesByPath.get(dependencyPath)

    // No module indexed for this dependency
    if (dependencyModule === undefined) {
      return [dependencyPath]
    }

    // Keep traversing the child dependencies and return the current dependency path
    return [...traverseLocalDependencies(dependencyModule, modulesByPath), dependencyPath]
  })
}

export class EdgeFunctionsRegistry {
  public importMapFromDeployConfig?: string

  private buildError: Error | null = null
  private bundler: typeof import('@netlify/edge-bundler')
  private configPath: string
  private importMapFromTOML?: string
  private declarationsFromDeployConfig: Declaration[] = []
  private declarationsFromTOML: Declaration[]

  // Mapping file URLs to names of functions that use them as dependencies.
  private dependencyPaths = new MultiMap<string, string>()

  private directories: string[]
  private directoryWatchers = new Map<string, import('chokidar').FSWatcher>()
  private env: Record<string, string>
  private featureFlags: FeatureFlags

  private userFunctions: EdgeFunction[] = []
  private internalFunctions: EdgeFunction[] = []

  // a Map from `this.functions` that maps function paths to function
  // names. This allows us to match modules against functions in O(1) time as
  // opposed to O(n).
  private functionPaths = new Map<string, string>()

  private getUpdatedConfig: () => Promise<Config>
  private initialScan: Promise<void>
  private manifest: Manifest | null = null
  private routes: Route[] = []
  private runIsolate: RunIsolate
  private servePath: string
  private projectDir: string
  private command: BaseCommand

  constructor({
    bundler,
    command,
    config,
    configPath,
    directories,
    env,
    featureFlags,
    getUpdatedConfig,
    importMapFromTOML,
    projectDir,
    runIsolate,
    servePath,
  }: EdgeFunctionsRegistryOptions) {
    this.command = command
    this.bundler = bundler
    this.configPath = configPath
    this.directories = directories
    this.featureFlags = featureFlags
    this.getUpdatedConfig = getUpdatedConfig
    this.runIsolate = runIsolate
    this.servePath = servePath
    this.projectDir = projectDir

    this.importMapFromTOML = importMapFromTOML
    this.declarationsFromTOML = EdgeFunctionsRegistry.getDeclarationsFromTOML(config)
    this.env = EdgeFunctionsRegistry.getEnvironmentVariables(env)

    this.initialScan = this.doInitialScan()

    this.setupWatchers()
  }

  private async doInitialScan() {
    await this.scanForFunctions()

    try {
      const { warnings } = await this.build()

      this.functions.forEach((func) => {
        this.logEvent('loaded', { functionName: func.name, warnings: warnings[func.name] })
      })
    } catch {
      // no-op
    }
  }

  private get functions() {
    return [...this.internalFunctions, ...this.userFunctions]
  }

  private async build() {
    const warnings: Record<string, string[]> = {}

    try {
      const { functionsConfig, graph, npmSpecifiersWithExtraneousFiles, success } = await this.runBuild()

      if (!success) {
        throw new Error('Build error')
      }

      this.buildError = null

      // We use one index to loop over both internal and user function, because we know that this.#functions has internalFunctions first.
      // functionsConfig therefore contains first all internal functionConfigs and then user functionConfigs
      let index = 0

      const internalFunctionConfigs = this.internalFunctions.reduce(
        // eslint-disable-next-line no-plusplus
        (acc, func) => ({ ...acc, [func.name]: functionsConfig[index++] }),
        {} as Record<string, FunctionConfig>,
      )

      const userFunctionConfigs = this.userFunctions.reduce(
        // eslint-disable-next-line no-plusplus
        (acc, func) => ({ ...acc, [func.name]: functionsConfig[index++] }),
        {} as Record<string, FunctionConfig>,
      )

      const { manifest, routes, unroutedFunctions } = this.buildRoutes(internalFunctionConfigs, userFunctionConfigs)

      this.manifest = manifest
      this.routes = routes

      unroutedFunctions.forEach((name) => {
        warnings[name] = warnings[name] || []
        warnings[name].push(
          `Edge function is not accessible because it does not have a path configured. Learn more at https://ntl.fyi/edge-create.`,
        )
      })

      for (const functionName in userFunctionConfigs) {
        if ('paths' in userFunctionConfigs[functionName]) {
          warnings[functionName] = warnings[functionName] || []
          warnings[functionName].push(`Unknown 'paths' configuration property. Did you mean 'path'?`)
        }
      }

      this.processGraph(graph)

      if (npmSpecifiersWithExtraneousFiles.length !== 0) {
        const modules = npmSpecifiersWithExtraneousFiles.map((name) => chalk.yellow(name)).join(', ')

        log(
          `${NETLIFYDEVWARN} The following npm modules, which are directly or indirectly imported by an edge function, may not be supported: ${modules}. For more information, visit https://ntl.fyi/edge-functions-npm.`,
        )
      }

      return { warnings }
    } catch (error) {
      if (error instanceof Error) {
        this.buildError = error
      }

      throw error
    }
  }

  /**
   * Builds a manifest and corresponding routes for the functions in the
   * registry, taking into account the declarations from the TOML, from
   * the deploy configuration API, and from the in-source configuration
   * found in both internal and user functions.
   */
  private buildRoutes(
    internalFunctionConfigs: Record<string, FunctionConfig>,
    userFunctionConfigs: Record<string, FunctionConfig>,
  ) {
    const declarations = this.bundler.mergeDeclarations(
      this.declarationsFromTOML,
      userFunctionConfigs,
      internalFunctionConfigs,
      this.declarationsFromDeployConfig,
      this.featureFlags,
    )
    const { declarationsWithoutFunction, manifest, unroutedFunctions } = this.bundler.generateManifest({
      declarations,
      userFunctionConfig: userFunctionConfigs,
      internalFunctionConfig: internalFunctionConfigs,
      functions: this.functions,
      featureFlags: this.featureFlags,
    })
    const routes = [...manifest.routes, ...manifest.post_cache_routes].map((route) => ({
      ...route,
      pattern: new RegExp(route.pattern),
    }))

    return { declarationsWithoutFunction, manifest, routes, unroutedFunctions }
  }

  private async checkForAddedOrDeletedFunctions() {
    const { deleted: deletedFunctions, new: newFunctions } = await this.scanForFunctions()

    if (newFunctions.length === 0 && deletedFunctions.length === 0) {
      return
    }

    try {
      const { warnings } = await this.build()

      deletedFunctions.forEach((func) => {
        this.logEvent('removed', { functionName: func.name, warnings: warnings[func.name] })
      })

      newFunctions.forEach((func) => {
        this.logEvent('loaded', { functionName: func.name, warnings: warnings[func.name] })
      })
    } catch {
      // no-op
    }
  }

  private static getDeclarationsFromTOML(config: Config) {
    const { edge_functions: edgeFunctions = [] } = config

    return edgeFunctions
  }

  private getDisplayName(func: string) {
    const declarations = [...this.declarationsFromTOML, ...this.declarationsFromDeployConfig]

    return declarations.find((declaration) => declaration.function === func)?.name ?? func
  }

  private static getEnvironmentVariables(envConfig: Record<string, { sources: string[]; value: string }>) {
    const env = Object.create(null)

    Object.entries(envConfig).forEach(([key, variable]) => {
      if (
        variable.sources.includes('ui') ||
        variable.sources.includes('account') ||
        variable.sources.includes('addons') ||
        variable.sources.includes('internal') ||
        variable.sources.some((source) => source.startsWith('.env'))
      ) {
        env[key] = variable.value
      }
    })

    env.DENO_REGION = 'local'

    return env
  }

  private async handleFileChange(paths: string[]) {
    const matchingFunctions = new Set(
      [
        ...paths.map((path) => this.functionPaths.get(path)),
        ...paths.flatMap((path) => this.dependencyPaths.get(path)),
      ].filter(nonNullable),
    )

    // If the file is not associated with any function, there's no point in
    // building. However, it might be that the path is in fact associated with
    // a function but we just haven't registered it due to a build error. So if
    // there was a build error, let's always build.
    if (matchingFunctions.size === 0 && this.buildError === null) {
      return
    }

    this.logEvent('reloading', {})

    try {
      const { warnings } = await this.build()
      const functionNames = [...matchingFunctions]

      if (functionNames.length === 0) {
        this.logEvent('reloaded', {})
      } else {
        functionNames.forEach((functionName) => {
          this.logEvent('reloaded', { functionName, warnings: warnings[functionName] })
        })
      }
    } catch (error) {
      if (isNodeError(error)) {
        this.logEvent('buildError', { buildError: error })
      }
    }
  }

  async initialize() {
    return await this.initialScan
  }

  /**
   * Logs an event associated with functions.
   */
  private logEvent(
    event: EdgeFunctionEvent,
    { buildError, functionName, warnings = [] }: { buildError?: Error; functionName?: string; warnings?: string[] },
  ) {
    const subject = functionName ? `edge function ${chalk.yellow(this.getDisplayName(functionName))}` : 'edge functions'
    const warningsText =
      warnings.length === 0 ? '' : ` with warnings:\n${warnings.map((warning) => `  - ${warning}`).join('\n')}`

    if (event === 'buildError') {
      log(`${NETLIFYDEVERR} ${chalk.red('Failed to load')} ${subject}: ${buildError}`)

      return
    }

    if (event === 'loaded') {
      const icon = warningsText ? NETLIFYDEVWARN : NETLIFYDEVLOG
      const color = warningsText ? chalk.yellow : chalk.green

      log(`${icon} ${color('Loaded')} ${subject}${warningsText}`)

      return
    }

    if (event === 'reloaded') {
      const icon = warningsText ? NETLIFYDEVWARN : NETLIFYDEVLOG
      const color = warningsText ? chalk.yellow : chalk.green

      log(`${icon} ${color('Reloaded')} ${subject}${warningsText}`)

      return
    }

    if (event === 'reloading') {
      log(`${NETLIFYDEVLOG} ${chalk.magenta('Reloading')} ${subject}...`)

      return
    }

    if (event === 'removed') {
      log(`${NETLIFYDEVLOG} ${chalk.magenta('Removed')} ${subject}`)
    }
  }

  /**
   * Returns the functions in the registry that should run for a given URL path
   * and HTTP method, based on the routes registered for each function.
   */
  matchURLPath(urlPath: string, method: string) {
    const functionNames: string[] = []
    const routeIndexes: number[] = []

    this.routes.forEach((route, index) => {
      if (route.methods && route.methods.length !== 0 && !route.methods.includes(method)) {
        return
      }

      if (!route.pattern.test(urlPath)) {
        return
      }

      const isExcluded = this.manifest?.function_config[route.function]?.excluded_patterns?.some((pattern) =>
        new RegExp(pattern).test(urlPath),
      )

      if (isExcluded) {
        return
      }

      functionNames.push(route.function)
      routeIndexes.push(index)
    })

    const routes = [...(this.manifest?.routes || []), ...(this.manifest?.post_cache_routes || [])].map((route) => ({
      function: route.function,
      path: route.path,
      pattern: route.pattern,
    }))
    const invocationMetadata = {
      function_config: this.manifest?.function_config,
      req_routes: routeIndexes,
      routes,
    }

    return { functionNames, invocationMetadata }
  }

  /**
   * Takes the module graph returned from the server and tracks dependencies of
   * each function.
   */
  private processGraph(graph: ModuleGraph | undefined) {
    if (!graph) {
      if (this.functions.length !== 0) {
        warn('Could not process edge functions dependency graph. Live reload will not be available.')
      }

      return
    }

    this.dependencyPaths = new MultiMap<string, string>()

    // Mapping file URLs to modules. Used by the traversal function.
    const modulesByPath = new Map<string, ModuleJson>()

    // a set of edge function modules that we'll use to start traversing the dependency tree from
    const functionModules = new Set<{ functionName: string; module: ModuleJson }>()
    graph.modules.forEach((module) => {
      // We're interested in tracking local dependencies, so we only look at
      // specifiers with the `file:` protocol.
      const { specifier } = module
      if (!specifier.startsWith('file://')) {
        return
      }

      const path = fileURLToPath(specifier)
      modulesByPath.set(path, module)

      const functionName = this.functionPaths.get(path)
      if (functionName) {
        functionModules.add({ functionName, module })
      }
    })

    // We start from our functions and we traverse through their dependency tree
    functionModules.forEach(({ functionName, module }) => {
      const traversedPaths = traverseLocalDependencies(module, modulesByPath)
      traversedPaths.forEach((dependencyPath) => {
        this.dependencyPaths.add(dependencyPath, functionName)
      })
    })
  }

  /**
   * Thin wrapper for `#runIsolate` that skips running a build and returns an
   * empty response if there are no functions in the registry.
   */
  private async runBuild() {
    if (this.functions.length === 0) {
      return {
        functionsConfig: [],
        npmSpecifiersWithExtraneousFiles: [],
        success: true,
      }
    }

    const { functionsConfig, graph, npmSpecifiersWithExtraneousFiles, success } = await this.runIsolate(
      this.functions,
      this.env,
      {
        getFunctionsConfig: true,
        importMapPaths: [this.importMapFromTOML, this.importMapFromDeployConfig].filter(nonNullable),
      },
    )

    return { functionsConfig, graph, npmSpecifiersWithExtraneousFiles, success }
  }

  private get internalDirectory() {
    return join(this.projectDir, this.command.getPathInProject(INTERNAL_EDGE_FUNCTIONS_FOLDER))
  }

  private async readDeployConfig() {
    const manifestPath = join(this.internalDirectory, 'manifest.json')
    try {
      const contents = await readFile(manifestPath, 'utf8')
      const manifest = JSON.parse(contents)
      return manifest
    } catch {}
  }

  private async scanForDeployConfig() {
    const deployConfig = await this.readDeployConfig()
    if (!deployConfig) {
      return
    }

    if (deployConfig.version !== 1) {
      throw new Error('Unsupported manifest format')
    }

    this.declarationsFromDeployConfig = deployConfig.functions
    this.importMapFromDeployConfig = deployConfig.import_map
      ? join(this.internalDirectory, deployConfig.import_map)
      : undefined
  }

  private async scanForFunctions() {
    const [internalFunctions, userFunctions] = await Promise.all([
      this.bundler.find([this.internalDirectory]),
      this.bundler.find(this.directories),
      this.scanForDeployConfig(),
    ])
    const functions = [...internalFunctions, ...userFunctions]
    const newFunctions = functions.filter((func) => {
      const functionExists = this.functions.some(
        (existingFunc) => func.name === existingFunc.name && func.path === existingFunc.path,
      )

      return !functionExists
    })
    const deletedFunctions = this.functions.filter((existingFunc) => {
      const functionExists = functions.some(
        (func) => func.name === existingFunc.name && func.path === existingFunc.path,
      )

      return !functionExists
    })

    this.internalFunctions = internalFunctions
    this.userFunctions = userFunctions

    // eslint-disable-next-line unicorn/prefer-spread
    this.functionPaths = new Map(Array.from(this.functions, (func) => [func.path, func.name]))

    return { all: functions, new: newFunctions, deleted: deletedFunctions }
  }

  private async setupWatchers() {
    // While functions are guaranteed to be inside one of the configured
    // directories, they might be importing files that are located in
    // parent directories. So we watch the entire project directory for
    // changes.
    await this.setupWatcherForDirectory()

    if (!this.configPath) {
      return
    }

    // Creating a watcher for the config file. When it changes, we update the
    // declarations and see if we need to register or unregister any functions.
    await watchDebounced(this.configPath, {
      onChange: async () => {
        const newConfig = await this.getUpdatedConfig()

        this.declarationsFromTOML = EdgeFunctionsRegistry.getDeclarationsFromTOML(newConfig)

        await this.checkForAddedOrDeletedFunctions()
      },
    })
  }

  private async setupWatcherForDirectory() {
    const ignored = [`${this.servePath}/**`]
    const watcher = await watchDebounced(this.projectDir, {
      ignored,
      onAdd: () => this.checkForAddedOrDeletedFunctions(),
      onChange: (paths) => this.handleFileChange(paths),
      onUnlink: () => this.checkForAddedOrDeletedFunctions(),
    })

    this.directoryWatchers.set(this.projectDir, watcher)
  }
}
