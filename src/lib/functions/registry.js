// @ts-check
const { mkdir } = require('fs').promises
const { extname, isAbsolute, join } = require('path')
const { env } = require('process')

const {
  NETLIFYDEVERR,
  NETLIFYDEVLOG,
  NETLIFYDEVWARN,
  chalk,
  getTerminalLink,
  log,
  warn,
  watchDebounced,
} = require('../../utils')
const { getLogMessage } = require('../log')

const { NetlifyFunction } = require('./netlify-function')
const runtimes = require('./runtimes')

const ZIP_EXTENSION = '.zip'

class FunctionsRegistry {
  constructor({ capabilities, config, isConnected = false, projectRoot, settings, timeouts }) {
    this.capabilities = capabilities
    this.config = config
    this.isConnected = isConnected
    this.projectRoot = projectRoot
    this.timeouts = timeouts
    this.settings = settings

    // An object to be shared among all functions in the registry. It can be
    // used to cache the results of the build function — e.g. it's used in
    // the `memoizedBuild` method in the JavaScript runtime.
    this.buildCache = {}

    // File watchers for parent directories where functions live — i.e. the
    // ones supplied to `scan()`. This is a Map because in the future we
    // might have several function directories.
    this.directoryWatchers = new Map()

    // The functions held by the registry. Maps function names to instances of
    // `NetlifyFunction`.
    this.functions = new Map()

    // File watchers for function files. Maps function names to objects built
    // by the `watchDebounced` utility.
    this.functionWatchers = new Map()

    // Performance optimization: load '@netlify/zip-it-and-ship-it' on demand.
    // eslint-disable-next-line n/global-require
    const { listFunctions } = require('@netlify/zip-it-and-ship-it')

    this.listFunctions = listFunctions
  }

  static async prepareDirectoryScan(directory) {
    await mkdir(directory, { recursive: true })

    // We give runtimes the opportunity to react to a directory scan and run
    // additional logic before the directory is read. So if they implement a
    // `onDirectoryScan` hook, we run it.
    await Promise.all(
      Object.values(runtimes).map((runtime) => {
        if (typeof runtime.onDirectoryScan !== 'function') {
          return null
        }

        return runtime.onDirectoryScan({ directory })
      }),
    )
  }

  async buildFunctionAndWatchFiles(func, { verbose = false } = {}) {
    if (verbose) {
      log(`${NETLIFYDEVLOG} ${chalk.magenta('Reloading')} function ${chalk.yellow(func.name)}...`)
    }

    const { error_, includedFiles, srcFilesDiff } = await func.build({ cache: this.buildCache })

    if (error_) {
      log(
        `${NETLIFYDEVERR} ${chalk.red('Failed')} reloading function ${chalk.yellow(func.name)} with error:\n${
          error_.message
        }`,
      )
    } else if (verbose) {
      log(`${NETLIFYDEVLOG} ${chalk.green('Reloaded')} function ${chalk.yellow(func.name)}`)
    }

    // If the build hasn't resulted in any files being added or removed, there
    // is nothing else we need to do.
    if (!srcFilesDiff) {
      return
    }

    const watcher = this.functionWatchers.get(func.name)

    // If there is already a watcher for this function, we need to unwatch any
    // files that have been removed and watch any files that have been added.
    if (watcher) {
      srcFilesDiff.deleted.forEach((path) => {
        watcher.unwatch(path)
      })

      srcFilesDiff.added.forEach((path) => {
        watcher.add(path)
      })

      return
    }

    // If there is no watcher for this function but the build produced files,
    // we create a new watcher and watch them.
    if (srcFilesDiff.added.size !== 0) {
      const filesToWatch = [...srcFilesDiff.added, ...includedFiles]

      const newWatcher = await watchDebounced(filesToWatch, {
        onChange: () => {
          this.buildFunctionAndWatchFiles(func, { verbose: true })
        },
      })

      this.functionWatchers.set(func.name, newWatcher)
    }
  }

  get(name) {
    return this.functions.get(name)
  }

  registerFunction(name, funcBeforeHook) {
    const { runtime } = funcBeforeHook

    // The `onRegister` hook allows runtimes to modify the function before it's
    // registered, or to prevent it from being registered altogether if the
    // hook returns `null`.
    const func = typeof runtime.onRegister === 'function' ? runtime.onRegister(funcBeforeHook) : funcBeforeHook

    if (func === null) {
      return
    }

    if (func.isBackground && this.isConnected && !this.capabilities.backgroundFunctions) {
      warn(getLogMessage('functions.backgroundNotSupported'))
    }

    if (!func.hasValidName()) {
      warn(
        `Function name '${func.name}' is invalid. It should consist only of alphanumeric characters, hyphen & underscores.`,
      )
    }

    // This fixes the bug described here https://github.com/netlify/zip-it-and-ship-it/issues/637
    // If the current function's file is a zip bundle, we ignore it and log a helpful message.
    if (extname(func.mainFile) === ZIP_EXTENSION) {
      log(`${NETLIFYDEVWARN} Skipped bundled function ${chalk.yellow(name)}. Unzip the archive to load it from source.`)
      return
    }

    this.functions.set(name, func)
    this.buildFunctionAndWatchFiles(func)

    log(`${NETLIFYDEVLOG} ${chalk.green('Loaded')} function ${getTerminalLink(chalk.yellow(name), func.url)}.`)
  }

  async scan(relativeDirs) {
    const directories = relativeDirs.filter(Boolean).map((dir) => (isAbsolute(dir) ? dir : join(this.projectRoot, dir)))

    // check after filtering to filter out [undefined] for example
    if (directories.length === 0) {
      return
    }

    await Promise.all(directories.map((path) => FunctionsRegistry.prepareDirectoryScan(path)))

    const functions = await this.listFunctions(directories, {
      featureFlags: {
        buildRustSource: env.NETLIFY_EXPERIMENTAL_BUILD_RUST_SOURCE === 'true',
      },
      config: this.config,
    })

    // Before registering any functions, we look for any functions that were on
    // the previous list but are missing from the new one. We unregister them.
    const deletedFunctions = [...this.functions.values()].filter((oldFunc) => {
      const isFound = functions.some(
        (newFunc) => newFunc.name === oldFunc.name && newFunc.runtime === oldFunc.runtime.name,
      )

      return !isFound
    })

    await Promise.all(deletedFunctions.map((func) => this.unregisterFunction(func.name)))

    functions.forEach(({ mainFile, name, runtime: runtimeName }) => {
      const runtime = runtimes[runtimeName]

      // If there is no matching runtime, it means this function is not yet
      // supported in Netlify Dev.
      if (runtime === undefined) {
        return
      }

      // If this function has already been registered, we skip it.
      if (this.functions.has(name)) {
        return
      }

      const func = new NetlifyFunction({
        config: this.config,
        directory: directories.find((directory) => mainFile.startsWith(directory)),
        mainFile,
        name,
        projectRoot: this.projectRoot,
        runtime,
        timeoutBackground: this.timeouts.backgroundFunctions,
        timeoutSynchronous: this.timeouts.syncFunctions,
        settings: this.settings,
      })

      this.registerFunction(name, func)
    })

    await Promise.all(directories.map((path) => this.setupDirectoryWatcher(path)))
  }

  // This watcher looks at files being added or removed from a functions
  // directory. It doesn't care about files being changed, because those
  // will be handled by each functions' watcher.
  async setupDirectoryWatcher(directory) {
    if (this.directoryWatchers.has(directory)) {
      return
    }

    const watcher = await watchDebounced(directory, {
      depth: 1,
      onAdd: () => {
        this.scan([directory])
      },
      onUnlink: () => {
        this.scan([directory])
      },
    })

    this.directoryWatchers.set(directory, watcher)
  }

  async unregisterFunction(name) {
    this.functions.delete(name)

    log(`${NETLIFYDEVLOG} ${chalk.magenta('Removed')} function ${chalk.yellow(name)}.`)

    const watcher = this.functionWatchers.get(name)

    if (watcher) {
      await watcher.close()
    }
  }
}

module.exports = { FunctionsRegistry }
