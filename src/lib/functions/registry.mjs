// @ts-check
import { mkdir } from 'fs/promises'
import { extname, isAbsolute, join, resolve } from 'path'
import { env } from 'process'

import extractZip from 'extract-zip'

import {
  chalk,
  getTerminalLink,
  log,
  NETLIFYDEVERR,
  NETLIFYDEVLOG,
  warn,
  watchDebounced,
} from '../../utils/command-helpers.mjs'
import { INTERNAL_FUNCTIONS_FOLDER, SERVE_FUNCTIONS_FOLDER } from '../../utils/functions/functions.mjs'
import { getLogMessage } from '../log.mjs'
import { getPathInProject } from '../settings.mjs'

import NetlifyFunction from './netlify-function.mjs'
import runtimes from './runtimes/index.mjs'

const ZIP_EXTENSION = '.zip'

export class FunctionsRegistry {
  constructor({ capabilities, config, debug = false, isConnected = false, projectRoot, settings, timeouts }) {
    this.capabilities = capabilities
    this.config = config
    this.debug = debug
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

  async registerFunction(name, funcBeforeHook) {
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

    // If the function file is a ZIP, we extract it and rewire its main file to
    // the new location.
    if (extname(func.mainFile) === ZIP_EXTENSION) {
      const unzippedDirectory = await this.unzipFunction(func)

      if (this.debug) {
        log(`${NETLIFYDEVLOG} ${chalk.green('Extracted')} function ${chalk.yellow(name)} from ${func.mainFile}.`)
      }

      func.mainFile = join(unzippedDirectory, `${func.name}.js`)
    }

    this.functions.set(name, func)
    this.buildFunctionAndWatchFiles(func)

    log(
      `${NETLIFYDEVLOG} ${chalk.green('Loaded')} function ${getTerminalLink(
        chalk.yellow(func.displayName || name),
        func.url,
      )}.`,
    )
  }

  // This function is here so we can mock it in tests
  // eslint-disable-next-line class-methods-use-this
  async listFunctions(...args) {
    // Performance optimization: load '@netlify/zip-it-and-ship-it' on demand.
    const { listFunctions } = await import('@netlify/zip-it-and-ship-it')

    return await listFunctions(...args)
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
      configFileDirectories: [getPathInProject([INTERNAL_FUNCTIONS_FOLDER])],
      config: this.config.functions,
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

    await Promise.all(
      functions.map(async ({ displayName, mainFile, name, runtime: runtimeName }) => {
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
          displayName,
          projectRoot: this.projectRoot,
          runtime,
          timeoutBackground: this.timeouts.backgroundFunctions,
          timeoutSynchronous: this.timeouts.syncFunctions,
          settings: this.settings,
        })

        await this.registerFunction(name, func)
      }),
    )

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

  async unzipFunction(func) {
    const targetDirectory = resolve(
      this.projectRoot,
      getPathInProject([SERVE_FUNCTIONS_FOLDER, '.unzipped', func.name]),
    )

    await extractZip(func.mainFile, { dir: targetDirectory })

    return targetDirectory
  }
}
