 
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
/** @typedef {import('@netlify/edge-bundler').ModuleGraph} ModuleGraph */
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
    // @ts-expect-error TS(7031) FIXME: Binding element 'bundler' implicitly has an 'any' ... Remove this comment to see the full error message
    bundler,
    // @ts-expect-error TS(7031) FIXME: Binding element 'config' implicitly has an 'any' t... Remove this comment to see the full error message
    config,
    // @ts-expect-error TS(7031) FIXME: Binding element 'configPath' implicitly has an 'an... Remove this comment to see the full error message
    configPath,
    // @ts-expect-error TS(7031) FIXME: Binding element 'debug' implicitly has an 'any' ty... Remove this comment to see the full error message
    debug,
    // @ts-expect-error TS(7031) FIXME: Binding element 'directories' implicitly has an 'a... Remove this comment to see the full error message
    directories,
    // @ts-expect-error TS(7031) FIXME: Binding element 'env' implicitly has an 'any' type... Remove this comment to see the full error message
    env,
    // @ts-expect-error TS(7031) FIXME: Binding element 'getUpdatedConfig' implicitly has ... Remove this comment to see the full error message
    getUpdatedConfig,
    // @ts-expect-error TS(7031) FIXME: Binding element 'internalDirectories' implicitly h... Remove this comment to see the full error message
    internalDirectories,
    // @ts-expect-error TS(7031) FIXME: Binding element 'internalFunctions' implicitly has... Remove this comment to see the full error message
    internalFunctions,
    // @ts-expect-error TS(7031) FIXME: Binding element 'projectDir' implicitly has an 'an... Remove this comment to see the full error message
    projectDir,
    // @ts-expect-error TS(7031) FIXME: Binding element 'runIsolate' implicitly has an 'an... Remove this comment to see the full error message
    runIsolate,
    // @ts-expect-error TS(7031) FIXME: Binding element 'servePath' implicitly has an 'any... Remove this comment to see the full error message
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
        // @ts-expect-error TS(2345) FIXME: Argument of type '{ functionName: any; warnings: a... Remove this comment to see the full error message
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
        // @ts-expect-error TS(2339) FIXME: Property 'name' does not exist on type 'never'.
        // eslint-disable-next-line no-plusplus
        (acc, func) => ({ ...acc, [func.name]: functionsConfig[index++] }),
        {},
      )

      /** @type {Record<string, FunctionConfig>} */
      const userFunctionConfigs = this.#userFunctions.reduce(
        // @ts-expect-error TS(2339) FIXME: Property 'name' does not exist on type 'never'.
        // eslint-disable-next-line no-plusplus
        (acc, func) => ({ ...acc, [func.name]: functionsConfig[index++] }),
        {},
      )

      const { manifest, routes, unroutedFunctions } = this.#buildRoutes(internalFunctionConfigs, userFunctionConfigs)

      this.#manifest = manifest
      // @ts-expect-error TS(2322) FIXME: Type 'any[]' is not assignable to type 'never[]'.
      this.#routes = routes

      // @ts-expect-error TS(7006) FIXME: Parameter 'name' implicitly has an 'any' type.
      unroutedFunctions.forEach((name) => {
        // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        warnings[name] = warnings[name] || []
        // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        warnings[name].push(
          `Edge function is not accessible because it does not have a path configured. Learn more at https://ntl.fyi/edge-create.`,
        )
      })

      for (const functionName in userFunctionConfigs) {
        // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        if ('paths' in userFunctionConfigs[functionName]) {
          // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          warnings[functionName] = warnings[functionName] || []
          // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          warnings[functionName].push(`Unknown 'paths' configuration property. Did you mean 'path'?`)
        }
      }

      this.#processGraph(graph)

      if (npmSpecifiersWithExtraneousFiles.length !== 0) {
        // @ts-expect-error TS(7006) FIXME: Parameter 'name' implicitly has an 'any' type.
        const modules = npmSpecifiersWithExtraneousFiles.map((name) => chalk.yellow(name)).join(', ')

        log(
          `${NETLIFYDEVWARN} The following npm modules, which are directly or indirectly imported by an edge function, may not be supported: ${modules}. For more information, visit https://ntl.fyi/edge-functions-npm.`,
        )
      }

      return { warnings }
    } catch (error) {
      // @ts-expect-error TS(2322) FIXME: Type 'unknown' is not assignable to type 'null'.
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
  // @ts-expect-error TS(7006) FIXME: Parameter 'internalFunctionConfigs' implicitly has... Remove this comment to see the full error message
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
        // @ts-expect-error TS(2345) FIXME: Argument of type '{ functionName: any; warnings: a... Remove this comment to see the full error message
        this.#logEvent('removed', { functionName: func.name, warnings: warnings[func.name] })
      })

      newFunctions.forEach((func) => {
        // @ts-expect-error TS(2345) FIXME: Argument of type '{ functionName: any; warnings: a... Remove this comment to see the full error message
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
  // @ts-expect-error TS(7006) FIXME: Parameter 'config' implicitly has an 'any' type.
  static #getDeclarationsFromTOML(config) {
    const { edge_functions: edgeFunctions = [] } = config

    return edgeFunctions
  }

  /**
   * @param {Record<string, { sources:string[], value:string }>} envConfig
   * @returns {Record<string, string>}
   */
  // @ts-expect-error TS(7006) FIXME: Parameter 'envConfig' implicitly has an 'any' type... Remove this comment to see the full error message
  static #getEnvironmentVariables(envConfig) {
    const env = Object.create(null)
    Object.entries(envConfig).forEach(([key, variable]) => {
      if (
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        variable.sources.includes('ui') ||
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        variable.sources.includes('account') ||
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        variable.sources.includes('addons') ||
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        variable.sources.includes('internal') ||
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        variable.sources.some((source) => source.startsWith('.env'))
      ) {
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
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
  // @ts-expect-error TS(7006) FIXME: Parameter 'paths' implicitly has an 'any' type.
  async #handleFileChange(paths) {
    const matchingFunctions = new Set(
      [
        // @ts-expect-error TS(7006) FIXME: Parameter 'path' implicitly has an 'any' type.
        ...paths.map((path) => this.#functionPaths.get(path)),
        // @ts-expect-error TS(7006) FIXME: Parameter 'path' implicitly has an 'any' type.
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

    // @ts-expect-error TS(2345) FIXME: Argument of type '{}' is not assignable to paramet... Remove this comment to see the full error message
    this.#logEvent('reloading', {})

    try {
      const { warnings } = await this.#build()
      const functionNames = [...matchingFunctions]

      if (functionNames.length === 0) {
        // @ts-expect-error TS(2345) FIXME: Argument of type '{}' is not assignable to paramet... Remove this comment to see the full error message
        this.#logEvent('reloaded', {})
      } else {
        functionNames.forEach((functionName) => {
          // @ts-expect-error TS(2345) FIXME: Argument of type '{ functionName: any; warnings: a... Remove this comment to see the full error message
          this.#logEvent('reloaded', { functionName, warnings: warnings[functionName] })
        })
      }
    } catch (error) {
      // @ts-expect-error TS(2345) FIXME: Argument of type '{ buildError: any; }' is not ass... Remove this comment to see the full error message
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
  // @ts-expect-error TS(7006) FIXME: Parameter 'event' implicitly has an 'any' type.
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
  // @ts-expect-error TS(7006) FIXME: Parameter 'urlPath' implicitly has an 'any' type.
  matchURLPath(urlPath, method) {
    /** @type string[] */
    // @ts-expect-error TS(7034) FIXME: Variable 'functionNames' implicitly has type 'any[... Remove this comment to see the full error message
    const functionNames = []

    /** @type number[] */
    // @ts-expect-error TS(7034) FIXME: Variable 'routeIndexes' implicitly has type 'any[]... Remove this comment to see the full error message
    const routeIndexes = []

    this.#routes.forEach((route, index) => {
      // @ts-expect-error TS(2339) FIXME: Property 'methods' does not exist on type 'never'.
      if (route.methods && route.methods.length !== 0 && !route.methods.includes(method)) {
        return
      }

      // @ts-expect-error TS(2339) FIXME: Property 'pattern' does not exist on type 'never'.
      if (!route.pattern.test(urlPath)) {
        return
      }

      // @ts-expect-error TS(2339) FIXME: Property 'function_config' does not exist on type ... Remove this comment to see the full error message
      const isExcluded = this.#manifest?.function_config[route.function]?.excluded_patterns?.some((pattern) =>
        new RegExp(pattern).test(urlPath),
      )

      if (isExcluded) {
        return
      }

      // @ts-expect-error TS(2339) FIXME: Property 'function' does not exist on type 'never'... Remove this comment to see the full error message
      functionNames.push(route.function)
      routeIndexes.push(index)
    })
    const invocationMetadata = {
      // @ts-expect-error TS(2339) FIXME: Property 'function_config' does not exist on type ... Remove this comment to see the full error message
      function_config: this.#manifest?.function_config,
      // @ts-expect-error TS(7005) FIXME: Variable 'routeIndexes' implicitly has an 'any[]' ... Remove this comment to see the full error message
      req_routes: routeIndexes,
      // @ts-expect-error TS(2339) FIXME: Property 'routes' does not exist on type 'never'.
      routes: this.#manifest?.routes.map((route) => ({
        function: route.function,
        path: route.path,
        pattern: route.pattern,
      })),
    }

    // @ts-expect-error TS(7005) FIXME: Variable 'functionNames' implicitly has an 'any[]'... Remove this comment to see the full error message
    return { functionNames, invocationMetadata }
  }

  /**
   * Takes the module graph returned from the server and tracks dependencies of
   * each function.
   *
   * @param {ModuleGraph} graph
   */
  // @ts-expect-error TS(7006) FIXME: Parameter 'graph' implicitly has an 'any' type.
  #processGraph(graph) {
    if (!graph) {
      warn('Could not process edge functions dependency graph. Live reload will not be available.')

      return
    }

    // Creating a Map from `this.#functions` that map function paths to function
    // names. This allows us to match modules against functions in O(1) time as
    // opposed to O(n).
    // @ts-expect-error TS(2339) FIXME: Property 'path' does not exist on type 'never'.
    // eslint-disable-next-line unicorn/prefer-spread
    const functionPaths = new Map(Array.from(this.#functions, (func) => [func.path, func.name]))

    // Mapping file URLs to names of functions that use them as dependencies.
    const dependencyPaths = new Map()

    // @ts-expect-error TS(7031) FIXME: Binding element 'specifier' implicitly has an 'any... Remove this comment to see the full error message
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
          // @ts-expect-error TS(2339) FIXME: Property 'code' does not exist on type 'never'.
          dependency.code === undefined ||
          // @ts-expect-error TS(2339) FIXME: Property 'code' does not exist on type 'never'.
          typeof dependency.code.specifier !== 'string' ||
          // @ts-expect-error TS(2339) FIXME: Property 'code' does not exist on type 'never'.
          !dependency.code.specifier.startsWith('file://')
        ) {
          return
        }

        // @ts-expect-error TS(2339) FIXME: Property 'code' does not exist on type 'never'.
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
        // @ts-expect-error TS(2339) FIXME: Property 'name' does not exist on type 'never'.
        (existingFunc) => func.name === existingFunc.name && func.path === existingFunc.path,
      )

      return !functionExists
    })
    const deletedFunctions = this.#functions.filter((existingFunc) => {
      const functionExists = functions.some(
        // @ts-expect-error TS(2339) FIXME: Property 'name' does not exist on type 'never'.
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
  // @ts-expect-error TS(7006) FIXME: Parameter 'projectDir' implicitly has an 'any' typ... Remove this comment to see the full error message
  async #setupWatchers(projectDir) {
    if (this.#configPath) {
      // Creating a watcher for the config file. When it changes, we update the
      // declarations and see if we need to register or unregister any functions.
      // @ts-expect-error TS(2345) FIXME: Argument of type '{ onChange: () => Promise<void>;... Remove this comment to see the full error message
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
  // @ts-expect-error TS(7006) FIXME: Parameter 'directory' implicitly has an 'any' type... Remove this comment to see the full error message
  async #setupWatcherForDirectory(directory) {
    const ignored = [`${this.#servePath}/**`]
    const watcher = await watchDebounced(directory, {
      // @ts-expect-error TS(2322) FIXME: Type 'string[]' is not assignable to type 'never[]... Remove this comment to see the full error message
      ignored,
      onAdd: () => this.#checkForAddedOrDeletedFunctions(),
      // @ts-expect-error TS(2322) FIXME: Type '(paths: any) => Promise<void>' is not assign... Remove this comment to see the full error message
      onChange: (paths) => this.#handleFileChange(paths),
      onUnlink: () => this.#checkForAddedOrDeletedFunctions(),
    })

    this.#directoryWatchers.set(directory, watcher)
  }

  /**
   * @param {string} func
   * @returns {string | undefined}
   */
  // @ts-expect-error TS(7006) FIXME: Parameter 'func' implicitly has an 'any' type.
  #getDisplayName(func) {
    const declarations = [...this.#declarationsFromTOML, ...this.#declarationsFromDeployConfig]

    return declarations.find((declaration) => declaration.function === func)?.name ?? func
  }
}
