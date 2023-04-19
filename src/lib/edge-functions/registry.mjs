// @ts-check
import { fileURLToPath } from 'url'

import { NETLIFYDEVERR, NETLIFYDEVLOG, chalk, log, warn, watchDebounced } from '../../utils/command-helpers.mjs'

/** @typedef {import('@netlify/edge-bundler').Declaration} Declaration */
/** @typedef {import('@netlify/edge-bundler').EdgeFunction} EdgeFunction */
/** @typedef {import('@netlify/edge-bundler').FunctionConfig} FunctionConfig */
/** @typedef {Awaited<ReturnType<typeof import('@netlify/edge-bundler').serve>>} RunIsolate */

const featureFlags = { edge_functions_correct_order: true }

export class EdgeFunctionsRegistry {
  /** @type {import('@netlify/edge-bundler')} */
  #bundler

  /** @type {string} */
  #configPath

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

  /** @type {Record<string, FunctionConfig>} */
  #userFunctionConfigs = {}

  /** @type {Record<string, FunctionConfig>} */
  #internalFunctionConfigs = {}

  /** @type {Declaration[]} */
  #declarationsFromTOML

  /** @type {Record<string, string>} */
  #env

  /** @type {import('chokidar').FSWatcher} */
  #configWatcher

  /** @type {Map<string, import('chokidar').FSWatcher>} */
  #directoryWatchers = new Map()

  /** @type {Map<string, string[]>} */
  #dependencyPaths = new Map()

  /** @type {Map<string, string>} */
  #functionPaths = new Map()

  /** @type {EdgeFunction[]} */
  #userFunctions = []

  /** @type {EdgeFunction[]} */
  #internalFunctions = []

  /** @type {Promise<void>} */
  #initialScan

  /**
   * @param {Object} opts
   * @param {import('@netlify/edge-bundler')} opts.bundler
   * @param {object} opts.config
   * @param {string} opts.configPath
   * @param {string[]} opts.directories
   * @param {Record<string, { sources: string[], value: string}>} opts.env
   * @param {() => Promise<object>} opts.getUpdatedConfig
   * @param {string[]} opts.internalDirectories
   * @param {Declaration[]} opts.internalFunctions
   * @param {string} opts.projectDir
   * @param {RunIsolate} opts.runIsolate
   */
  constructor({
    bundler,
    config,
    configPath,
    directories,
    env,
    getUpdatedConfig,
    internalDirectories,
    internalFunctions,
    projectDir,
    runIsolate,
  }) {
    this.#bundler = bundler
    this.#configPath = configPath
    this.#directories = directories
    this.#internalDirectories = internalDirectories
    this.#getUpdatedConfig = getUpdatedConfig
    this.#runIsolate = runIsolate

    this.#declarationsFromDeployConfig = internalFunctions
    this.#declarationsFromTOML = EdgeFunctionsRegistry.#getDeclarationsFromTOML(config)
    this.#env = EdgeFunctionsRegistry.#getEnvironmentVariables(env)

    this.#buildError = null
    this.#userFunctionConfigs = {}
    this.#internalFunctionConfigs = {}
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

    this.#functions.forEach((func) => {
      this.#logAddedFunction(func)
    })

    try {
      await this.#build()
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
   * @return {Promise<void>}
   */
  async #build() {
    try {
      const { functionsConfig, graph, success } = await this.#runIsolate(this.#functions, this.#env, {
        getFunctionsConfig: true,
      })

      if (!success) {
        throw new Error('Build error')
      }

      this.#buildError = null

      // We use one index to loop over both internal and user function, because we know that this.#functions has internalFunctions first.
      // functionsConfig therefore contains first all internal functionConfigs and then user functionConfigs
      let index = 0

      this.#internalFunctionConfigs = this.#internalFunctions.reduce(
        // eslint-disable-next-line no-plusplus
        (acc, func) => ({ ...acc, [func.name]: functionsConfig[index++] }),
        {},
      )

      this.#userFunctionConfigs = this.#userFunctions.reduce(
        // eslint-disable-next-line no-plusplus
        (acc, func) => ({ ...acc, [func.name]: functionsConfig[index++] }),
        {},
      )

      this.#processGraph(graph)
    } catch (error) {
      this.#buildError = error

      throw error
    }
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
      await this.#build()

      deletedFunctions.forEach((func) => {
        this.#logDeletedFunction(func)
      })

      newFunctions.forEach((func) => {
        this.#logAddedFunction(func)
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
   * @param {string} path
   * @returns {Promise<void>}
   */
  async #handleFileChange(path) {
    const matchingFunctions = new Set(
      [this.#functionPaths.get(path), ...(this.#dependencyPaths.get(path) || [])].filter(Boolean),
    )

    // If the file is not associated with any function, there's no point in
    // building. However, it might be that the path is in fact associated with
    // a function but we just haven't registered it due to a build error. So if
    // there was a build error, let's always build.
    if (matchingFunctions.size === 0 && this.#buildError === null) {
      return
    }

    log(`${NETLIFYDEVLOG} ${chalk.magenta('Reloading')} edge functions...`)

    try {
      await this.#build()

      const functionNames = [...matchingFunctions]

      if (functionNames.length === 0) {
        log(`${NETLIFYDEVLOG} ${chalk.green('Reloaded')} edge functions`)
      } else {
        functionNames.forEach((functionName) => {
          log(
            `${NETLIFYDEVLOG} ${chalk.green('Reloaded')} edge function ${chalk.yellow(
              this.#getDisplayName(functionName),
            )}`,
          )
        })
      }
    } catch {
      log(`${NETLIFYDEVERR} ${chalk.red('Failed')} reloading edge function`)
    }
  }

  /**
   * @return {Promise<void>}
   */
  async initialize() {
    return await this.#initialScan
  }

  /**
   * @param {EdgeFunction} func
   */
  #logAddedFunction(func) {
    log(`${NETLIFYDEVLOG} ${chalk.green('Loaded')} edge function ${chalk.yellow(this.#getDisplayName(func.name))}`)
  }

  /**
   * @param {EdgeFunction} func
   */
  #logDeletedFunction(func) {
    log(`${NETLIFYDEVLOG} ${chalk.magenta('Removed')} edge function ${chalk.yellow(this.#getDisplayName(func.name))}`)
  }

  /**
   * @param {string} urlPath
   */
  matchURLPath(urlPath) {
    const declarations = this.#bundler.mergeDeclarations(
      this.#declarationsFromTOML,
      this.#userFunctionConfigs,
      this.#internalFunctionConfigs,
      this.#declarationsFromDeployConfig,
      featureFlags,
    )
    const manifest = this.#bundler.generateManifest({
      declarations,
      userFunctionConfig: this.#userFunctionConfigs,
      internalFunctionConfig: this.#internalFunctionConfigs,
      functions: this.#functions,
      featureFlags,
    })
    const invocationMetadata = {
      function_config: manifest.function_config,
      routes: manifest.routes.map((route) => ({ function: route.function, pattern: route.pattern })),
    }
    const routes = [...manifest.routes, ...manifest.post_cache_routes].map((route) => ({
      ...route,
      pattern: new RegExp(route.pattern),
    }))
    const functionNames = routes
      .filter(({ pattern }) => pattern.test(urlPath))
      .filter(({ function: name }) => {
        const isExcluded = manifest.function_config[name]?.excluded_patterns?.some((pattern) =>
          new RegExp(pattern).test(urlPath),
        )
        return !isExcluded
      })
      .map((route) => route.function)
    const orphanedDeclarations = this.#matchURLPathAgainstOrphanedDeclarations(urlPath)

    return { functionNames, invocationMetadata, orphanedDeclarations }
  }

  /**
   *
   * @param {string} urlPath
   * @returns {string[]}
   */
  #matchURLPathAgainstOrphanedDeclarations(urlPath) {
    // `generateManifest` will only include functions for which there is both a
    // function file and a config declaration, but we want to catch cases where
    // a config declaration exists without a matching function file. To do that
    // we compute a list of functions from the declarations (the `path` doesn't
    // really matter).
    const functions = this.#declarationsFromTOML.map((declaration) => ({ name: declaration.function, path: '' }))
    const manifest = this.#bundler.generateManifest({
      declarations: this.#declarationsFromTOML,
      userFunctionConfig: this.#userFunctionConfigs,
      internalFunctionConfig: this.#internalFunctionConfigs,
      functions,
      featureFlags,
    })

    const routes = [...manifest.routes, ...manifest.post_cache_routes].map((route) => ({
      ...route,
      pattern: new RegExp(route.pattern),
    }))

    const functionNames = routes
      .filter((route) => {
        const hasFunctionFile = this.#functions.some((func) => func.name === route.function)

        if (hasFunctionFile) {
          return false
        }

        return route.pattern.test(urlPath)
      })
      .map((route) => route.function)

    return functionNames
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
    // Creating a watcher for the config file. When it changes, we update the
    // declarations and see if we need to register or unregister any functions.
    this.#configWatcher = await watchDebounced(this.#configPath, {
      onChange: async () => {
        const newConfig = await this.#getUpdatedConfig()

        this.#declarationsFromTOML = EdgeFunctionsRegistry.#getDeclarationsFromTOML(newConfig)

        await this.#checkForAddedOrDeletedFunctions()
      },
    })

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
    const watcher = await watchDebounced(directory, {
      onAdd: () => this.#checkForAddedOrDeletedFunctions(),
      onChange: (path) => this.#handleFileChange(path),
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
