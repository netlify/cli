import { readFile } from 'fs/promises'
import { join } from 'path'
import { fileURLToPath } from 'url'

import type { Declaration, EdgeFunction, FunctionConfig, Manifest, ModuleGraph } from '@netlify/edge-bundler'
import type { AIGatewayContext } from '@netlify/ai/bootstrap'
import { watchDebounced } from '@netlify/dev-utils'

import BaseCommand from '../../commands/base-command.js'
import {
  NETLIFYDEVERR,
  NETLIFYDEVLOG,
  NETLIFYDEVWARN,
  nonNullable,
  chalk,
  log,
  warn,
  isNodeError,
  type NormalizedCachedConfigConfig,
} from '../../utils/command-helpers.js'
import type { FeatureFlags } from '../../utils/feature-flags.js'
import { MultiMap } from '../../utils/multimap.js'
import { getPathInProject } from '../settings.js'

import { DIST_IMPORT_MAP_PATH } from './consts.js'
import {
  getFrameworkEdgeFunctionsDirectory,
  getInternalEdgeFunctionsDirectory,
  getUserEdgeFunctionsDirectory,
} from './get-directories.js'

type DependencyCache = Record<string, string[]>
type EdgeFunctionEvent = 'buildError' | 'loaded' | 'reloaded' | 'reloading' | 'removed'
type Route = Omit<Manifest['routes'][0], 'pattern'> & { pattern: RegExp }
type RunIsolate = Awaited<ReturnType<typeof import('@netlify/edge-bundler').serve>>

type ModuleJson = ModuleGraph['modules'][number]

interface EdgeFunctionsRegistryOptions {
  aiGatewayContext?: AIGatewayContext | null
  bundler: typeof import('@netlify/edge-bundler')
  command: BaseCommand
  config: NormalizedCachedConfigConfig
  configPath: string
  debug: boolean
  env: Record<string, { sources: string[]; value: string }>
  featureFlags: FeatureFlags
  getUpdatedConfig: () => Promise<NormalizedCachedConfigConfig>
  importMapFromTOML?: string
  projectDir: string
  runIsolate: RunIsolate
  servePath: string
}

/**
 * Given an Edge Bundler module graph and an index of modules by path,
 * traverses its dependency tree and returns an array of all of its
 * local dependencies.
 */
function traverseLocalDependencies(
  { dependencies = [], specifier }: ModuleJson,
  modulesByPath: Map<string, ModuleJson>,
  cache: DependencyCache,
): string[] {
  // If we've already traversed this specifier, return the cached list of
  // dependencies.
  if (cache[specifier] !== undefined) {
    return cache[specifier]
  }

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

    // No module indexed for this dependency.
    if (dependencyModule === undefined) {
      return [dependencyPath]
    }

    // Keep traversing the child dependencies and return the current dependency path.
    cache[specifier] = [...traverseLocalDependencies(dependencyModule, modulesByPath, cache), dependencyPath]

    return cache[specifier]
  })
}

export class EdgeFunctionsRegistry {
  public importMapFromDeployConfig?: string

  private aiGatewayContext?: AIGatewayContext | null
  private buildError: Error | null = null

  // protected for testing only, not a stable extension point
  protected buildPending = false
  protected buildPromise: Promise<{ warnings: Record<string, string[]> }> | null = null
  private bundler: typeof import('@netlify/edge-bundler')
  private configPath: string
  private importMapFromTOML?: string
  private declarationsFromDeployConfig: Declaration[] = []
  private declarationsFromTOML: Declaration[]

  // Mapping file URLs to names of functions that use them as dependencies.
  private dependencyPaths = new MultiMap<string, string>()

  private directoryWatchers = new Map<string, import('chokidar').FSWatcher>()
  private env: Record<string, string>
  private featureFlags: FeatureFlags

  private userFunctions: EdgeFunction[] = []
  private internalFunctions: EdgeFunction[] = []

  // a Map from `this.functions` that maps function paths to function
  // names. This allows us to match modules against functions in O(1) time as
  // opposed to O(n).
  private functionPaths = new Map<string, string>()

  private getUpdatedConfig: () => Promise<NormalizedCachedConfigConfig>
  private initialScan: Promise<void>
  private manifest: Manifest | null = null
  private routes: Route[] = []
  private runIsolate: RunIsolate
  private servePath: string
  private projectDir: string
  private command: BaseCommand

  constructor({
    aiGatewayContext,
    bundler,
    command,
    config,
    configPath,
    env,
    featureFlags,
    getUpdatedConfig,
    importMapFromTOML,
    projectDir,
    runIsolate,
    servePath,
  }: EdgeFunctionsRegistryOptions) {
    this.aiGatewayContext = aiGatewayContext
    this.command = command
    this.bundler = bundler
    this.configPath = configPath
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
    } catch (error) {
      this.logEvent('buildError', { buildError: error as NodeJS.ErrnoException })
    }
  }

  private get functions() {
    return [...this.internalFunctions, ...this.userFunctions]
  }

  // Note: We intentionally don't use @netlify/dev-utils memoize() here because
  // it has a 300ms debounce and fire-and-forget logic. Edge function build
  // needs callers to receive the latest build result
  //
  // @internal - protected for testing only, not a stable extension point
  protected async build(): Promise<{ warnings: Record<string, string[]> }> {
    // If a build is already in progress, mark that we need another build
    // and return the current build's promise. The running build will
    // trigger a rebuild when it completes if buildPending is true.
    if (this.buildPromise) {
      this.buildPending = true
      return this.buildPromise
    }

    this.buildPending = false
    this.buildPromise = this.doBuild()

    try {
      const result = await this.buildPromise
      this.buildPromise = null

      // If another build was requested while we were building, run it now
      if (this.buildPending) {
        return await this.build()
      }

      return result
    } catch (error) {
      this.buildPromise = null

      // If another build was requested while we were building, run it now
      if (this.buildPending) {
        return await this.build()
      }

      throw error
    }
  }

  // @internal - protected for testing only, not a stable extension point
  protected async doBuild(): Promise<{ warnings: Record<string, string[]> }> {
    const warnings: Record<string, string[]> = {}

    try {
      const { functionsConfig, graph, success } = await this.runBuild()

      if (!success) {
        throw new Error('Build error')
      }

      this.buildError = null

      // We use one index to loop over both internal and user function, because we know that this.#functions has internalFunctions first.
      // functionsConfig therefore contains first all internal functionConfigs and then user functionConfigs
      let index = 0

      const internalFunctionConfigs = this.internalFunctions.reduce<Record<string, FunctionConfig>>(
        (acc, func) => ({ ...acc, [func.name]: functionsConfig[index++] }),
        {},
      )

      const userFunctionConfigs = this.userFunctions.reduce<Record<string, FunctionConfig>>(
        (acc, func) => ({ ...acc, [func.name]: functionsConfig[index++] }),
        {},
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

  private static getDeclarationsFromTOML(config: NormalizedCachedConfigConfig) {
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
    await this.initialScan
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
  matchURLPath(urlPath: string, method: string, headers: Record<string, string | string[] | undefined>) {
    const functionNames: string[] = []
    const routeIndexes: number[] = []

    this.routes.forEach((route, index) => {
      if (route.methods && route.methods.length !== 0 && !route.methods.includes(method)) {
        return
      }

      if (!route.pattern.test(urlPath)) {
        return
      }

      if (route.headers) {
        const headerMatches = Object.entries(route.headers).every(([rawHeaderName, headerMatch]) => {
          const headerName = rawHeaderName.toLowerCase()
          const headerValueString = Array.isArray(headers[headerName])
            ? headers[headerName].filter(Boolean).join(',')
            : headers[headerName]

          if (headerMatch?.matcher === 'exists') {
            return headers[headerName] !== undefined
          }

          if (headerMatch?.matcher === 'missing') {
            return headers[headerName] === undefined
          }

          if (headerValueString && headerMatch?.matcher === 'regex') {
            const pattern = new RegExp(headerMatch.pattern)

            return pattern.test(headerValueString)
          }

          return false
        })

        if (!headerMatches) {
          return
        }
      }

      const isExcludedForFunction = this.manifest?.function_config[route.function]?.excluded_patterns?.some((pattern) =>
        new RegExp(pattern).test(urlPath),
      )
      if (isExcludedForFunction) {
        return
      }

      const isExcludedForRoute = route.excluded_patterns.some((pattern) => new RegExp(pattern).test(urlPath))
      if (isExcludedForRoute) {
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

    const dependencyCache: DependencyCache = {}

    // We start from our functions and we traverse through their dependency tree
    functionModules.forEach(({ functionName, module }) => {
      const traversedPaths = traverseLocalDependencies(module, modulesByPath, dependencyCache)
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
        success: true,
      }
    }

    const importMapPaths = [this.importMapFromTOML, this.importMapFromDeployConfig]

    if (this.usesFrameworksAPI) {
      const { edgeFunctionsImportMap } = this.command.netlify.frameworksAPIPaths

      if (await edgeFunctionsImportMap.exists()) {
        importMapPaths.push(edgeFunctionsImportMap.path)
      }
    }

    const { functionsConfig, graph, success } = await this.runIsolate(this.functions, this.env, {
      getFunctionsConfig: true,
      importMapPaths: importMapPaths.filter(nonNullable),
    })

    return { functionsConfig, graph, success }
  }

  private get internalImportMapPath() {
    return join(this.projectDir, getPathInProject([DIST_IMPORT_MAP_PATH]))
  }

  private async readDeployConfig() {
    const manifestPath = join(getInternalEdgeFunctionsDirectory(this.command), 'manifest.json')
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
      ? join(getInternalEdgeFunctionsDirectory(this.command), deployConfig.import_map)
      : undefined
  }

  private async scanForFunctions() {
    const userFunctionDirectory = getUserEdgeFunctionsDirectory(this.command)
    const [frameworkFunctions, integrationFunctions, userFunctions] = await Promise.all([
      this.usesFrameworksAPI ? this.bundler.find([getFrameworkEdgeFunctionsDirectory(this.command)]) : [],
      this.bundler.find([getInternalEdgeFunctionsDirectory(this.command)]),
      userFunctionDirectory ? this.bundler.find([userFunctionDirectory]) : [],
      this.scanForDeployConfig(),
    ])
    const internalFunctions = [...frameworkFunctions, ...integrationFunctions]
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
    const ignored = [`${this.servePath}/**`, this.internalImportMapPath]
    const watcher = await watchDebounced(this.projectDir, {
      ignored,
      onAdd: () => this.checkForAddedOrDeletedFunctions(),
      onChange: (paths) => this.handleFileChange(paths),
      onUnlink: () => this.checkForAddedOrDeletedFunctions(),
    })

    this.directoryWatchers.set(this.projectDir, watcher)
  }

  // We only take into account edge functions from the Frameworks API in
  // the `serve` command, since we don't run the build command in `dev`.
  private get usesFrameworksAPI() {
    return this.command.name() === 'serve'
  }
}
