// @ts-check
import { fileURLToPath } from 'url'

import {
  NETLIFYDEVERR,
  NETLIFYDEVLOG,
  NETLIFYDEVWARN,
  chalk,
  log,
  warn,
  watchDebounced,
} from '../../utils/command-helpers.mjs'

/** @typedef {import('@netlify/edge-bundler').Declaration} Declaration */
/** @typedef {import('@netlify/edge-bundler').EdgeFunction} EdgeFunction */
/**
 * @typedef {"buildError" | "loaded" | "reloaded" | "reloading" | "removed"} EdgeFunctionEvent
 */
/** @typedef {import('@netlify/edge-bundler').FunctionConfig} FunctionConfig */
/** @typedef {import('@netlify/edge-bundler').Manifest} Manifest */
/** @typedef {Awaited<ReturnType<typeof import('@netlify/edge-bundler').serve>>} RunIsolate */
/** @typedef {Omit<Manifest["routes"][0], "pattern"> & { pattern: RegExp }} Route */

const featureFlags = { edge_functions_correct_order: true }

export class EdgeFunctionsRegistry {
  /** @type {import('@netlify/edge-bundler')} */
  #bundler

  /** @type {string} */
  #configPath

  /** @type {boolean} */
  #debug

  /** @type {string[]} */
  #directories

  /** @type {string[]} */
  #internalDirectories

  /** @type {() => Promise<object>} */
  #getUpdatedConfig

  /** @type {RunIsolate} */
  #runIsolate

  /** @type {Error | null} */
  #buildError = null

  /** @type {Declaration[]} */
  #declarationsFromDeployConfig

  /** @type {Declaration[]} */
  #declarationsFromTOML

  /** @type {Record<string, string>} */
  #env

  /** @type {Map<string, import('chokidar').FSWatcher>} */
  #directoryWatchers = new Map()

  /** @type {Map<string, string[]>} */
  #dependencyPaths = new Map()

  /** @type {Map<string, string>} */
  #functionPaths = new Map()

  /** @type {Manifest | null} */
  #manifest = null

  /** @type {EdgeFunction[]} */
  #userFunctions = []

  /** @type {EdgeFunction[]} */
  #internalFunctions = []

  /** @type {Promise<void>} */
  #initialScan

  /** @type {Route[]} */
  #routes = []

  /** @type {string} */
  #servePath

  /**
   * @param {Object} opts
   * @param {import('@netlify/edge-bundler')} opts.bundler
   * @param {object} opts.config
   * @param {string} opts.configPath
   * @param {boolean} opts.debug
   * @param {string[]} opts.directories
   * @param {Record<string, { sources: string[], value: string}>} opts.env
   * @param {() => Promise<object>} opts.getUpdatedConfig
   * @param {string[]} opts.internalDirectories
   * @param {Declaration[]} opts.internalFunctions
   * @param {string} opts.projectDir
   * @param {RunIsolate} opts.runIsolate
   * @param {string} opts.servePath
   */
  constructor({
    bundler,
    config,
    configPath,
    debug,
    directories,
    env,
    getUpdatedConfig,
    internalDirectories,
    internalFunctions,
    projectDir,
    runIsolate,
    servePath,
  }) {
    this.#bundler = bundler
    this.#configPath = configPath
    this.#debug = debug
    this.#directories = directories
    this.#internalDirectories = internalDirectories
    this.#getUpdatedConfig = getUpdatedConfig
    this.#runIsolate = runIsolate
    this.#servePath = servePath

    this.#declarationsFromDeployConfig = internalFunctions
    this.#declarationsFromTOML = EdgeFunctionsRegistry.#getDeclarationsFromTOML(config)
    this.#env = EdgeFunctionsRegistry.#getEnvironmentVariables(env)

    this.#buildError = null
    this.#directoryWatchers = new Map()
    this.#dependencyPaths = new Map()
    this.#functionPaths = new Map()
    this.#userFunctions = []
    this.#internalFunctions = []

    this.#initialScan = this.#doInitialScan()

    this.#setupWatchers(projectDir)
  }

  /**
   * @returns {Promise<void>}
   */
  async #doInitialScan() {
    await this.#scanForFunctions()

    try {
      const { warnings } = await this.#build()

      this.#functions.forEach((func) => {
        this.#logEvent('loaded', { functionName: func.name, warnings: warnings[func.name] })
      })
    } catch {
      // no-op
    }
  }

  /**
   * @return {EdgeFunction[]}
   */
  get #functions() {
    return [...this.#internalFunctions, ...this.#userFunctions]
  }

  /**
   * @return {Promise<{warnings: Record<string, string[]>}>}
   */
  async #build() {
    /**
     * @type Record<string, string[]>
     */
    const warnings = {}

    try {
      const { functionsConfig, graph, npmSpecifiersWithExtraneousFiles, success } = await this.#runBuild()

      if (!success) {
        throw new Error('Build error')
      }

      this.#buildError = null

      // We use one index to loop over both internal and user function, because we know that this.#functions has internalFunctions first.
      // functionsConfig therefore contains first all internal functionConfigs and then user functionConfigs
      let index = 0

      /** @type {Record<string, FunctionConfig>} */
      const internalFunctionConfigs = this.#internalFunctions.reduce(
        // eslint-disable-next-line no-plusplus
        (acc, func) => ({ ...acc, [func.name]: functionsConfig[index++] }),
        {},
      )

      /** @type {Record<string, FunctionConfig>} */
      const userFunctionConfigs = this.#userFunctions.reduce(
        // eslint-disable-next-line no-plusplus
        (acc, func) => ({ ...acc, [func.name]: functionsConfig[index++] }),
        {},
      )

      const { manifest, routes, unroutedFunctions } = this.#buildRoutes(internalFunctionConfigs, userFunctionConfigs)

      this.#manifest = manifest
      this.#routes = routes

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

      this.#processGraph(graph)

      if (npmSpecifiersWithExtraneousFiles.length !== 0) {
        const modules = npmSpecifiersWithExtraneousFiles.map((name) => chalk.yellow(name)).join(', ')

        log(
          `${NETLIFYDEVWARN} The following npm modules, which are directly or indirectly imported by an edge function, may not be supported: ${modules}. For more information, visit https://ntl.fyi/edge-functions-npm.`,
        )
      }

      return { warnings }
    } catch (error) {
      this.#buildError = error

      throw error
    }
  }

  /**
   * Builds a manifest and corresponding routes for the functions in the
   * registry, taking into account the declarations from the TOML, from
   * the deploy configuration API, and from the in-source configuration
   * found in both internal and user functions.
   *
   * @param {Record<string, FunctionConfig>} internalFunctionConfigs
   * @param {Record<string, FunctionConfig>} userFunctionConfigs
   */
  #buildRoutes(internalFunctionConfigs, userFunctionConfigs) {
    const declarations = this.#bundler.mergeDeclarations(
      this.#declarationsFromTOML,
      userFunctionConfigs,
      internalFunctionConfigs,
      this.#declarationsFromDeployConfig,
      featureFlags,
    )
    const { declarationsWithoutFunction, manifest, unroutedFunctions } = this.#bundler.generateManifest({
      declarations,
      userFunctionConfig: userFunctionConfigs,
      internalFunctionConfig: internalFunctionConfigs,
      functions: this.#functions,
      featureFlags,
    })
    const routes = [...manifest.routes, ...manifest.post_cache_routes].map((route) => ({
      ...route,
      pattern: new RegExp(route.pattern),
    }))

    return { declarationsWithoutFunction, manifest, routes, unroutedFunctions }
  }

  /**
   * @returns {Promise<void>}
   */
  async #checkForAddedOrDeletedFunctions() {
    const { deleted: deletedFunctions, new: newFunctions } = await this.#scanForFunctions()

    if (newFunctions.length === 0 && deletedFunctions.length === 0) {
      return
    }

    try {
      const { warnings } = await this.#build()

      deletedFunctions.forEach((func) => {
        this.#logEvent('removed', { functionName: func.name, warnings: warnings[func.name] })
      })

      newFunctions.forEach((func) => {
        this.#logEvent('loaded', { functionName: func.name, warnings: warnings[func.name] })
      })
    } catch {
      // no-op
    }
  }

  /**
   * @param {any} config
   * @returns {Declaration[]}
   */
  static #getDeclarationsFromTOML(config) {
    const { edge_functions: edgeFunctions = [] } = config

    return edgeFunctions
  }

  /**
   * @param {Record<string, { sources:string[], value:string }>} envConfig
   * @returns {Record<string, string>}
   */
  static #getEnvironmentVariables(envConfig) {
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

  /**
   * @param {string[]} paths
   * @returns {Promise<void>}
   */
  async #handleFileChange(paths) {
    const matchingFunctions = new Set(
      [
        ...paths.map((path) => this.#functionPaths.get(path)),
        ...paths.flatMap((path) => this.#dependencyPaths.get(path)),
      ].filter(Boolean),
    )

    // If the file is not associated with any function, there's no point in
    // building. However, it might be that the path is in fact associated with
    // a function but we just haven't registered it due to a build error. So if
    // there was a build error, let's always build.
    if (matchingFunctions.size === 0 && this.#buildError === null) {
      return
    }

    this.#logEvent('reloading', {})

    try {
      const { warnings } = await this.#build()
      const functionNames = [...matchingFunctions]

      if (functionNames.length === 0) {
        this.#logEvent('reloaded', {})
      } else {
        functionNames.forEach((functionName) => {
          this.#logEvent('reloaded', { functionName, warnings: warnings[functionName] })
        })
      }
    } catch (error) {
      this.#logEvent('buildError', { buildError: error?.message })
    }
  }

  /**
   * @return {Promise<void>}
   */
  async initialize() {
    return await this.#initialScan
  }

  /**
   * Logs an event associated with functions.
   *
   * @param {EdgeFunctionEvent} event
   * @param {object} data
   * @param {Error} [data.buildError]
   * @param {string} [data.functionName]
   * @param {string[]} [data.warnings]
   * @returns
   */
  #logEvent(event, { buildError, functionName, warnings = [] }) {
    const subject = functionName
      ? `edge function ${chalk.yellow(this.#getDisplayName(functionName))}`
      : 'edge functions'
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
   *
   * @param {string} urlPath
   * @param {string} method
   */
  matchURLPath(urlPath, method) {
    /** @type string[] */
    const functionNames = []

    /** @type number[] */
    const routeIndexes = []

    this.#routes.forEach((route, index) => {
      if (route.methods && route.methods.length !== 0 && !route.methods.includes(method)) {
        return
      }

      if (!route.pattern.test(urlPath)) {
        return
      }

      const isExcluded = this.#manifest?.function_config[route.function]?.excluded_patterns?.some((pattern) =>
        new RegExp(pattern).test(urlPath),
      )

      if (isExcluded) {
        return
      }

      functionNames.push(route.function)
      routeIndexes.push(index)
    })
    const invocationMetadata = {
      function_config: this.#manifest?.function_config,
      req_routes: routeIndexes,
      routes: this.#manifest?.routes.map((route) => ({
        function: route.function,
        path: route.path,
        pattern: route.pattern,
      })),
    }

    return { functionNames, invocationMetadata }
  }

  #processGraph(graph) {
    if (!graph) {
      warn('Could not process edge functions dependency graph. Live reload will not be available.')

      return
    }

    // Creating a Map from `this.#functions` that map function paths to function
    // names. This allows us to match modules against functions in O(1) time as
    // opposed to O(n).
    // eslint-disable-next-line unicorn/prefer-spread
    const functionPaths = new Map(Array.from(this.#functions, (func) => [func.path, func.name]))

    // Mapping file URLs to names of functions that use them as dependencies.
    const dependencyPaths = new Map()

    graph.modules.forEach(({ dependencies = [], specifier }) => {
      if (!specifier.startsWith('file://')) {
        return
      }

      const path = fileURLToPath(specifier)
      const functionMatch = functionPaths.get(path)

      if (!functionMatch) {
        return
      }

      dependencies.forEach((dependency) => {
        // We're interested in tracking local dependencies, so we only look at
        // specifiers with the `file:` protocol.
        if (
          dependency.code === undefined ||
          typeof dependency.code.specifier !== 'string' ||
          !dependency.code.specifier.startsWith('file://')
        ) {
          return
        }

        const { specifier: dependencyURL } = dependency.code
        const dependencyPath = fileURLToPath(dependencyURL)
        const functions = dependencyPaths.get(dependencyPath) || []

        dependencyPaths.set(dependencyPath, [...functions, functionMatch])
      })
    })

    this.#dependencyPaths = dependencyPaths
    this.#functionPaths = functionPaths
  }

  /**
   * Thin wrapper for `#runIsolate` that skips running a build and returns an
   * empty response if there are no functions in the registry.
   */
  async #runBuild() {
    if (this.#functions.length === 0) {
      return {
        functionsConfig: [],
        graph: {
          modules: [],
        },
        npmSpecifiersWithExtraneousFiles: [],
        success: true,
      }
    }

    const { functionsConfig, graph, npmSpecifiersWithExtraneousFiles, success } = await this.#runIsolate(
      this.#functions,
      this.#env,
      {
        getFunctionsConfig: true,
      },
    )

    return { functionsConfig, graph, npmSpecifiersWithExtraneousFiles, success }
  }

  /**
   * @returns {Promise<{all: EdgeFunction[], new: EdgeFunction[], deleted: EdgeFunction[]}>}
   */
  async #scanForFunctions() {
    const [internalFunctions, userFunctions] = await Promise.all([
      this.#bundler.find(this.#internalDirectories),
      this.#bundler.find(this.#directories),
    ])

    const functions = [...internalFunctions, ...userFunctions]

    const newFunctions = functions.filter((func) => {
      const functionExists = this.#functions.some(
        (existingFunc) => func.name === existingFunc.name && func.path === existingFunc.path,
      )

      return !functionExists
    })
    const deletedFunctions = this.#functions.filter((existingFunc) => {
      const functionExists = functions.some(
        (func) => func.name === existingFunc.name && func.path === existingFunc.path,
      )

      return !functionExists
    })

    this.#internalFunctions = internalFunctions
    this.#userFunctions = userFunctions

    return { all: functions, new: newFunctions, deleted: deletedFunctions }
  }

  /**
   * @param {string} projectDir
   */
  async #setupWatchers(projectDir) {
    if (this.#configPath) {
      // Creating a watcher for the config file. When it changes, we update the
      // declarations and see if we need to register or unregister any functions.
      await watchDebounced(this.#configPath, {
        onChange: async () => {
          const newConfig = await this.#getUpdatedConfig()

          this.#declarationsFromTOML = EdgeFunctionsRegistry.#getDeclarationsFromTOML(newConfig)

          await this.#checkForAddedOrDeletedFunctions()
        },
      })
    }

    // While functions are guaranteed to be inside one of the configured
    // directories, they might be importing files that are located in
    // parent directories. So we watch the entire project directory for
    // changes.
    await this.#setupWatcherForDirectory(projectDir)
  }

  /**
   * @param {string} directory
   * @returns {Promise<void>}
   */
  async #setupWatcherForDirectory(directory) {
    const ignored = [`${this.#servePath}/**`]
    const watcher = await watchDebounced(directory, {
      ignored,
      onAdd: () => this.#checkForAddedOrDeletedFunctions(),
      onChange: (paths) => this.#handleFileChange(paths),
      onUnlink: () => this.#checkForAddedOrDeletedFunctions(),
    })

    this.#directoryWatchers.set(directory, watcher)
  }

  /**
   * @param {string} func
   * @returns {string | undefined}
   */
  #getDisplayName(func) {
    const declarations = [...this.#declarationsFromTOML, ...this.#declarationsFromDeployConfig]

    return declarations.find((declaration) => declaration.function === func)?.name ?? func
  }
}
