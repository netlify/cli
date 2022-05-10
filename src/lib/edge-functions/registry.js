// @ts-check
const { fileURLToPath } = require('url')

const { NETLIFYDEVERR, NETLIFYDEVLOG, chalk, log, warn, watchDebounced } = require('../../utils/command-helpers')

/**
 * @typedef EdgeFunction
 * @type {object}
 * @property {string} name
 * @property {string} path
 */

/**
 * @typedef EdgeFunctionDeclaration
 * @type {object}
 * @property {string} function
 * @property {string} path
 */

class EdgeFunctionsRegistry {
  /**
   * @param {Object} opts
   * @param {import('@netlify/edge-bundler')} opts.bundler
   * @param {object} opts.config
   * @param {string} opts.configPath
   * @param {string[]} opts.directories
   * @param {() => Promise<object>} opts.getUpdatedConfig
   * @param {EdgeFunction[]} opts.internalFunctions
   * @param {string} opts.projectDir
   * @param {(functions: EdgeFunction[]) => Promise<object>} opts.runIsolate
   */
  constructor({
    bundler,
    config,
    configPath,
    directories,
    getUpdatedConfig,
    internalFunctions,
    projectDir,
    runIsolate,
  }) {
    /**
     * @type {import('@netlify/edge-bundler')}
     */
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
     * @type {(functions: EdgeFunction[]) => Promise<object>}
     */
    this.runIsolate = runIsolate

    /**
     * @type {Error | null}
     */
    this.buildError = null

    /**
     * @type {EdgeFunctionDeclaration[]}
     */
    this.declarations = this.getDeclarations(config)

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
      const { graph, success } = await this.runIsolate(functions)

      if (!success) {
        throw new Error('Build error')
      }

      this.buildError = null

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

      const hasDeclaration = this.declarations.some((declaration) => declaration.function === func.name)

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
        EdgeFunctionsRegistry.logDeletedFunction(func)
      })

      newFunctions.forEach((func) => {
        EdgeFunctionsRegistry.logAddedFunction(func)
      })
    } catch {
      // no-op
    }
  }

  getDeclarations(config) {
    const { edge_functions: userFunctions = [] } = config

    // The order is important, since we want to run user-defined functions
    // before internal functions.
    const declarations = [...userFunctions, ...this.internalFunctions]

    return declarations
  }

  getManifest() {
    return this.bundler.generateManifest({ declarations: this.declarations, functions: this.functions })
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
          log(`${NETLIFYDEVLOG} ${chalk.green('Reloaded')} edge function ${chalk.yellow(functionName)}`)
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

  static logAddedFunction(func) {
    log(`${NETLIFYDEVLOG} ${chalk.green('Loaded')} edge function ${chalk.yellow(func.name)}`)
  }

  static logDeletedFunction(func) {
    log(`${NETLIFYDEVLOG} ${chalk.magenta('Removed')} edge function ${chalk.yellow(func.name)}`)
  }

  /**
   * @param {string} urlPath
   */
  async matchURLPath(urlPath) {
    // `generateManifest` will only include functions for which there is both a
    // function file and a config declaration, but we want to catch cases where
    // a config declaration exists without a matching function file. To do that
    // we compute a list of functions from the declarations (the `path` doesn't
    // really matter) and later on match the resulting routes against the list
    // of functions we have in the registry. Any functions found in the former
    // but not the latter are treated as orphaned declarations.
    const functions = this.declarations.map((declaration) => ({ name: declaration.function, path: '' }))
    const manifest = await this.bundler.generateManifest({
      declarations: this.declarations,
      functions,
    })
    const routes = manifest.routes.map((route) => ({
      ...route,
      pattern: new RegExp(route.pattern),
    }))
    const orphanedDeclarations = new Set()
    const functionNames = routes
      .filter(({ pattern }) => pattern.test(urlPath))
      .map((route) => {
        const matchingFunction = this.functions.find(({ name }) => name === route.function)

        if (matchingFunction === undefined) {
          orphanedDeclarations.add(route.function)

          return null
        }

        return matchingFunction.name
      })
      .filter(Boolean)

    return { functionNames, orphanedDeclarations }
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
      EdgeFunctionsRegistry.logAddedFunction(func)
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

        this.declarations = this.getDeclarations(newConfig)

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
}

module.exports = { EdgeFunctionsRegistry }
