// @ts-check
import { fileURLToPath } from 'url'

import { NETLIFYDEVERR, NETLIFYDEVLOG, chalk, log, warn, watchDebounced } from '../../utils/command-helpers.mjs'

// TODO: Import from `@netlify/edge-bundler` once it exports this type.
/**
 * @typedef InSourceDeclaration
 * @type {object}
 * @property {string} [cache]
 * @property {string} function
 * @property {string | string[]} [path]
 * @property {string | string[]} [excludedPath]
 */

/**
 * @typedef EdgeFunction
 * @type {object}
 * @property {string} name
 * @property {string} path
 */

/**
 * @typedef EdgeFunctionDeclarationWithPath
 * @type {object}
 * @property {string} function
 * @property {string} path
 * @property {string=} name
 */

/**
 * @typedef EdgeFunctionDeclarationWithPattern
 * @type {object}
 * @property {string} function
 * @property {string} pattern
 * @property {string=} name
 */

/** @typedef {(EdgeFunctionDeclarationWithPath | EdgeFunctionDeclarationWithPattern)} EdgeFunctionDeclaration */
/** @typedef {Awaited<ReturnType<typeof import('@netlify/edge-bundler').serve>>} RunIsolate */

export class EdgeFunctionsRegistry {
  /**
   * @param {Object} opts
   * @param {import('@netlify/edge-bundler')} opts.bundler
   * @param {object} opts.config
   * @param {string} opts.configPath
   * @param {string[]} opts.directories
   * @param {Record<string, string>} opts.env
   * @param {() => Promise<object>} opts.getUpdatedConfig
   * @param {EdgeFunction[]} opts.internalFunctions
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
    internalFunctions,
    projectDir,
    runIsolate,
  }) {
    this.bundler = bundler

    /**
     * @type {string}
     */
    this.configPath = configPath

    /**
     * @type {string[]}
     */
    this.directories = directories

    /**
     * @type {() => Promise<object>}
     */
    this.getUpdatedConfig = getUpdatedConfig

    /**
     * @type {EdgeFunction[]}
     */
    this.internalFunctions = internalFunctions

    /**
     * @type {RunIsolate}
     */
    this.runIsolate = runIsolate

    /**
     * @type {Error | null}
     */
    this.buildError = null

    /**
     * @type {EdgeFunctionDeclaration[]}
     */
    this.declarationsFromConfig = this.getDeclarationsFromConfig(config)

    /**
     * @type {InSourceDeclaration[]}
     */
    this.declarationsFromSource = []

    /**
     * @type {Record<string, string>}
     */
    this.env = EdgeFunctionsRegistry.getEnvironmentVariables(env)

    /**
     * @type {Map<string, import('chokidar').FSWatcher>}
     */
    this.directoryWatchers = new Map()

    /**
     * @type {Map<string, string[]>}
     */
    this.dependencyPaths = new Map()

    /**
     * @type {Map<string, string>}
     */
    this.functionPaths = new Map()

    /**
     * @type {EdgeFunction[]}
     */
    this.functions = []

    /**
     * @type {Promise<EdgeFunction[]>}
     */
    this.initialScan = this.scan(directories)

    this.setupWatchers({ projectDir })
  }

  /**
   * @param {EdgeFunction[]} functions
   */
  async build(functions) {
    try {
      const { functionsConfig, graph, success } = await this.runIsolate(functions, this.env, {
        getFunctionsConfig: true,
      })

      if (!success) {
        throw new Error('Build error')
      }

      this.buildError = null
      this.declarationsFromSource = functions.map((func, index) => ({ function: func.name, ...functionsConfig[index] }))

      this.processGraph(graph)
    } catch (error) {
      this.buildError = error

      throw error
    }
  }

  async checkForAddedOrDeletedFunctions() {
    const functionsFound = await this.bundler.find(this.directories)
    const newFunctions = functionsFound.filter((func) => {
      const functionExists = this.functions.some(
        (existingFunc) => func.name === existingFunc.name && func.path === existingFunc.path,
      )

      if (functionExists) {
        return
      }

      const hasDeclaration = this.declarationsFromConfig.some((declaration) => declaration.function === func.name)

      // We only load the function if there's a config declaration for it.
      return hasDeclaration
    })
    const deletedFunctions = this.functions.filter((existingFunc) => {
      const functionExists = functionsFound.some(
        (func) => func.name === existingFunc.name && func.path === existingFunc.path,
      )

      return !functionExists
    })

    this.functions = functionsFound

    if (newFunctions.length === 0 && deletedFunctions.length === 0) {
      return
    }

    try {
      await this.build(functionsFound)

      deletedFunctions.forEach((func) => {
        EdgeFunctionsRegistry.logDeletedFunction(func, this.findDisplayName(func.name))
      })

      newFunctions.forEach((func) => {
        EdgeFunctionsRegistry.logAddedFunction(func, this.findDisplayName(func.name))
      })
    } catch {
      // no-op
    }
  }

  getDeclarationsFromConfig(config) {
    const { edge_functions: userFunctions = [] } = config

    // The order is important, since we want to run user-defined functions
    // before internal functions.
    const declarations = [...userFunctions, ...this.internalFunctions]

    return declarations
  }

  static getEnvironmentVariables(envConfig) {
    const env = Object.create(null)
    Object.entries(envConfig).forEach(([key, variable]) => {
      if (
        variable.sources.includes('ui') ||
        variable.sources.includes('account') ||
        variable.sources.includes('addons') ||
        variable.sources.includes('internal')
      ) {
        env[key] = variable.value
      }
    })

    env.DENO_REGION = 'local'

    return env
  }

  async handleFileChange(path) {
    const matchingFunctions = new Set(
      [this.functionPaths.get(path), ...(this.dependencyPaths.get(path) || [])].filter(Boolean),
    )

    // If the file is not associated with any function, there's no point in
    // building. However, it might be that the path is in fact associated with
    // a function but we just haven't registered it due to a build error. So if
    // there was a build error, let's always build.
    if (matchingFunctions.size === 0 && this.buildError === null) {
      return
    }

    log(`${NETLIFYDEVLOG} ${chalk.magenta('Reloading')} edge functions...`)

    try {
      await this.build(this.functions)

      const functionNames = [...matchingFunctions]

      if (functionNames.length === 0) {
        log(`${NETLIFYDEVLOG} ${chalk.green('Reloaded')} edge functions`)
      } else {
        functionNames.forEach((functionName) => {
          const displayName = this.findDisplayName(functionName)
          log(`${NETLIFYDEVLOG} ${chalk.green('Reloaded')} edge function ${chalk.yellow(displayName || functionName)}`)
        })
      }
    } catch {
      log(`${NETLIFYDEVERR} ${chalk.red('Failed')} reloading edge function`)
    }
  }

  initialize() {
    this.initialization =
      this.initialization ||
      // eslint-disable-next-line promise/prefer-await-to-then
      this.initialScan.then(async (functions) => {
        try {
          await this.build(functions)
        } catch {
          // no-op
        }

        return null
      })

    return this.initialization
  }

  static logAddedFunction(func, displayName) {
    log(`${NETLIFYDEVLOG} ${chalk.green('Loaded')} edge function ${chalk.yellow(displayName || func.name)}`)
  }

  static logDeletedFunction(func, displayName) {
    log(`${NETLIFYDEVLOG} ${chalk.magenta('Removed')} edge function ${chalk.yellow(displayName || func.name)}`)
  }

  /**
   * @param {string} urlPath
   */
  async matchURLPath(urlPath) {
    const declarations = this.mergeDeclarations()
    const manifest = this.bundler.generateManifest({
      declarations,
      functions: this.functions,
    })
    const routes = [...manifest.routes, ...manifest.post_cache_routes].map((route) => ({
      ...route,
      pattern: new RegExp(route.pattern),
    }))
    const functionNames = routes
      .filter(({ pattern }) => pattern.test(urlPath))
      .filter(({ function: name }) => {
        const isExcluded = manifest.function_config[name]?.excluded_patterns.some((pattern) =>
          new RegExp(pattern).test(urlPath),
        )
        return !isExcluded
      })
      .map((route) => route.function)
    const orphanedDeclarations = await this.matchURLPathAgainstOrphanedDeclarations(urlPath)

    return { functionNames, orphanedDeclarations }
  }

  matchURLPathAgainstOrphanedDeclarations(urlPath) {
    // `generateManifest` will only include functions for which there is both a
    // function file and a config declaration, but we want to catch cases where
    // a config declaration exists without a matching function file. To do that
    // we compute a list of functions from the declarations (the `path` doesn't
    // really matter).
    const functions = this.declarationsFromConfig.map((declaration) => ({ name: declaration.function, path: '' }))
    const manifest = this.bundler.generateManifest({
      declarations: this.declarationsFromConfig,
      functions,
    })

    const routes = [...manifest.routes, ...manifest.post_cache_routes].map((route) => ({
      ...route,
      pattern: new RegExp(route.pattern),
    }))

    const functionNames = routes
      .filter((route) => {
        const hasFunctionFile = this.functions.some((func) => func.name === route.function)

        if (hasFunctionFile) {
          return false
        }

        return route.pattern.test(urlPath)
      })
      .map((route) => route.function)

    return functionNames
  }

  // Merges declarations coming from the config and from the function sources.
  mergeDeclarations() {
    const declarations = [...this.declarationsFromConfig]

    this.declarationsFromSource.forEach((declarationFromSource) => {
      const { path: pathOrPaths, ...configProps } = declarationFromSource

      // Find any declarations in the config for the function.
      const indexes = declarations
        .filter(({ function: func }) => func === declarationFromSource.function)
        .map((_, index) => index)

      // If the in-source declaration doesn't have a path, add its properties
      // to any existing declarations for the function.
      if (pathOrPaths === undefined) {
        indexes.forEach((index) => {
          declarations[index] = { ...declarations[index], ...configProps }
        })
      } else {
        // The in-source declaration has a path, and those take precedence.
        // Discard any config declarations first.
        indexes.forEach((index) => {
          declarations.splice(index, 1)
        })

        // The path may be an array or a string, so let's normalize that first.
        const paths = Array.isArray(pathOrPaths) ? pathOrPaths : [pathOrPaths]

        // Create a new declaration for each path.
        paths.forEach((path) => {
          declarations.push({ ...configProps, path })
        })
      }
    })

    const filteredDeclarations = declarations.filter((declaration) => 'path' in declaration || 'pattern' in declaration)

    return filteredDeclarations
  }

  processGraph(graph) {
    if (!graph) {
      warn('Could not process edge functions dependency graph. Live reload will not be available.')

      return
    }

    // Creating a Map from `this.functions` that map function paths to function
    // names. This allows us to match modules against functions in O(1) time as
    // opposed to O(n).
    // eslint-disable-next-line unicorn/prefer-spread
    const functionPaths = new Map(Array.from(this.functions, (func) => [func.path, func.name]))

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

    this.dependencyPaths = dependencyPaths
    this.functionPaths = functionPaths
  }

  async scan(directories) {
    const functions = await this.bundler.find(directories)

    functions.forEach((func) => {
      EdgeFunctionsRegistry.logAddedFunction(func, this.findDisplayName(func.name))
    })

    this.functions = functions

    return functions
  }

  async setupWatchers({ projectDir }) {
    // Creating a watcher for the config file. When it changes, we update the
    // declarations and see if we need to register or unregister any functions.
    this.configWatcher = await watchDebounced(this.configPath, {
      onChange: async () => {
        const newConfig = await this.getUpdatedConfig()

        this.declarationsFromConfig = this.getDeclarationsFromConfig(newConfig)

        await this.checkForAddedOrDeletedFunctions()
      },
    })

    // While functions are guaranteed to be inside one of the configured
    // directories, they might be importing files that are located in
    // parent directories. So we watch the entire project directory for
    // changes.
    await this.setupWatcherForDirectory(projectDir)
  }

  async setupWatcherForDirectory(directory) {
    const watcher = await watchDebounced(directory, {
      onAdd: () => this.checkForAddedOrDeletedFunctions(),
      onChange: (path) => this.handleFileChange(path),
      onUnlink: () => this.checkForAddedOrDeletedFunctions(),
    })

    this.directoryWatchers.set(directory, watcher)
  }

  findDisplayName(func) {
    return this.declarationsFromConfig?.find((declaration) => declaration.function === func)?.name
  }
}
