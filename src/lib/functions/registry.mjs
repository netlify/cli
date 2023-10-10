// @ts-check
import { mkdir } from 'fs/promises'
import { createRequire } from 'module'
import { basename, extname, isAbsolute, join, resolve } from 'path'
import { env } from 'process'

import { listFunctions } from '@netlify/zip-it-and-ship-it'
import extractZip from 'extract-zip'

import {
  chalk,
  log,
  getTerminalLink,
  NETLIFYDEVERR,
  NETLIFYDEVLOG,
  NETLIFYDEVWARN,
  warn,
  watchDebounced,
} from '../../utils/command-helpers.mjs'
import { INTERNAL_FUNCTIONS_FOLDER, SERVE_FUNCTIONS_FOLDER } from '../../utils/functions/functions.mjs'
import { BACKGROUND_FUNCTIONS_WARNING } from '../log.mjs'
import { getPathInProject } from '../settings.mjs'

import NetlifyFunction from './netlify-function.mjs'
import runtimes from './runtimes/index.mjs'

export const DEFAULT_FUNCTION_URL_EXPRESSION = /^\/.netlify\/(functions|builders)\/([^/]+).*/
const TYPES_PACKAGE = '@netlify/functions'
const ZIP_EXTENSION = '.zip'

/**
 * @typedef {"buildError" | "extracted" | "loaded" | "missing-types-package" | "reloaded" | "reloading" | "removed"} FunctionEvent
 */

export class FunctionsRegistry {
  constructor({
    capabilities,
    config,
    debug = false,
    isConnected = false,
    logLambdaCompat,
    projectRoot,
    settings,
    timeouts,
  }) {
    this.capabilities = capabilities
    this.config = config
    this.debug = debug
    this.isConnected = isConnected
    this.projectRoot = projectRoot
    this.timeouts = timeouts
    this.settings = settings

    /**
     * An object to be shared among all functions in the registry. It can be
     * used to cache the results of the build function — e.g. it's used in
     * the `memoizedBuild` method in the JavaScript runtime.
     *
     * @type {Record<string, unknown>}
     */
    this.buildCache = {}

    /**
     * File watchers for parent directories where functions live — i.e. the
     * ones supplied to `scan()`. This is a Map because in the future we
     * might have several function directories.
     *
     * @type {Map<string, Awaited<ReturnType<watchDebounced>>>}
     */
    this.directoryWatchers = new Map()

    /**
     * The functions held by the registry
     *
     * @type {Map<string, NetlifyFunction>}
     */
    this.functions = new Map()

    /**
     * File watchers for function files. Maps function names to objects built
     * by the `watchDebounced` utility.
     *
     * @type {Map<string, Awaited<ReturnType<watchDebounced>>>}
     */
    this.functionWatchers = new Map()

    /**
     * Keeps track of whether we've checked whether `TYPES_PACKAGE` is
     * installed.
     */
    this.hasCheckedTypesPackage = false

    /**
     * Whether to log V1 functions as using the "Lambda compatibility mode"
     *
     * @type {boolean}
     */
    this.logLambdaCompat = Boolean(logLambdaCompat)
  }

  checkTypesPackage() {
    if (this.hasCheckedTypesPackage) {
      return
    }

    this.hasCheckedTypesPackage = true

    const require = createRequire(this.projectRoot)

    try {
      require.resolve(TYPES_PACKAGE, { paths: [this.projectRoot] })
    } catch (error) {
      if (error?.code === 'MODULE_NOT_FOUND') {
        FunctionsRegistry.logEvent('missing-types-package', {})
      }
    }
  }

  /**
   * Runs before `scan` and calls any `onDirectoryScan` hooks defined by the
   * runtime before the directory is read. This gives runtime the opportunity
   * to run additional logic when a directory is scanned.
   *
   * @param {string} directory
   */
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

  /**
   * Builds a function and sets up the appropriate file watchers so that any
   * changes will trigger another build.
   *
   * @param {NetlifyFunction} func
   * @param {boolean} [firstLoad ]
   * @returns
   */
  async buildFunctionAndWatchFiles(func, firstLoad = false) {
    if (!firstLoad) {
      FunctionsRegistry.logEvent('reloading', { func })
    }

    const { error: buildError, includedFiles, srcFilesDiff } = await func.build({ cache: this.buildCache })

    if (buildError) {
      FunctionsRegistry.logEvent('buildError', { func })
    } else {
      const event = firstLoad ? 'loaded' : 'reloaded'
      const recommendedExtension = func.getRecommendedExtension()

      if (recommendedExtension) {
        const { filename } = func
        const newFilename = filename ? `${basename(filename, extname(filename))}${recommendedExtension}` : null
        const action = newFilename
          ? `rename the function file to ${chalk.underline(
              newFilename,
            )}. Refer to https://ntl.fyi/functions-runtime for more information`
          : `refer to https://ntl.fyi/functions-runtime`
        const warning = `The function is using the legacy CommonJS format. To start using ES modules, ${action}.`

        FunctionsRegistry.logEvent(event, { func, warnings: [warning] })
      } else {
        FunctionsRegistry.logEvent(event, { func })
      }
    }

    if (func.isTypeScript()) {
      this.checkTypesPackage()
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
          this.buildFunctionAndWatchFiles(func, false)
        },
      })

      this.functionWatchers.set(func.name, newWatcher)
    }
  }

  /**
   * Returns a function by name.
   *
   * @param {string} name
   */
  get(name) {
    return this.functions.get(name)
  }

  /**
   * Looks for the first function that matches a given URL path. If a match is
   * found, returns an object with the function and the route. If the URL path
   * matches the default functions URL (i.e. can only be for a function) but no
   * function with the given name exists, returns an object with the function
   * and the route set to `null`. Otherwise, `undefined` is returned,
   *
   * @param {string} url
   * @param {string} method
   */
  async getFunctionForURLPath(url, method) {
    // We're constructing a URL object just so that we can extract the path from
    // the incoming URL. It doesn't really matter that we don't have the actual
    // local URL with the correct port.
    const urlPath = new URL(url, 'http://localhost').pathname
    const defaultURLMatch = urlPath.match(DEFAULT_FUNCTION_URL_EXPRESSION)

    if (defaultURLMatch) {
      const func = this.get(defaultURLMatch[2])

      if (!func) {
        return { func: null, route: null }
      }

      const { routes = [] } = await func.getBuildData()

      if (routes.length !== 0) {
        const paths = routes.map((route) => chalk.underline(route.pattern)).join(', ')

        warn(
          `Function ${chalk.yellow(func.name)} cannot be invoked on ${chalk.underline(
            urlPath,
          )}, because the function has the following URL paths defined: ${paths}`,
        )

        return
      }

      return { func, route: null }
    }

    for (const func of this.functions.values()) {
      const route = await func.matchURLPath(urlPath, method)

      if (route) {
        return { func, route }
      }
    }
  }

  /**
   * Logs an event associated with functions.
   *
   * @param {FunctionEvent} event
   * @param {object} data
   * @param {NetlifyFunction} [data.func]
   * @param {string[]} [data.warnings]
   * @returns
   */
  static logEvent(event, { func, warnings = [] }) {
    let warningsText = ''

    if (warnings.length !== 0) {
      warningsText = ` with warnings:\n${warnings.map((warning) => `  - ${warning}`).join('\n')}`
    }

    if (event === 'buildError') {
      log(
        `${NETLIFYDEVERR} ${chalk.red('Failed to load')} function ${chalk.yellow(func?.displayName)}: ${
          func?.buildError?.message
        }`,
      )
    }

    if (event === 'extracted') {
      log(
        `${NETLIFYDEVLOG} ${chalk.green('Extracted')} function ${chalk.yellow(func?.displayName)} from ${
          func?.mainFile
        }.`,
      )

      return
    }

    if (event === 'loaded') {
      const icon = warningsText ? NETLIFYDEVWARN : NETLIFYDEVLOG
      const color = warningsText ? chalk.yellow : chalk.green
      const mode =
        func?.runtimeAPIVersion === 1 && this.logLambdaCompat
          ? ` in ${getTerminalLink('Lambda compatibility mode', 'https://ntl.fyi/lambda-compat')}`
          : ''

      log(`${icon} ${color('Loaded')} function ${chalk.yellow(func?.displayName)}${mode}${warningsText}`)

      return
    }

    if (event === 'missing-types-package') {
      log(
        `${NETLIFYDEVWARN} For a better experience with TypeScript functions, consider installing the ${chalk.underline(
          TYPES_PACKAGE,
        )} package. Refer to https://ntl-fyi/function-types for more information.`,
      )
    }

    if (event === 'reloaded') {
      const icon = warningsText ? NETLIFYDEVWARN : NETLIFYDEVLOG
      const color = warningsText ? chalk.yellow : chalk.green

      log(`${icon} ${color('Reloaded')} function ${chalk.yellow(func?.displayName)}${warningsText}`)

      return
    }

    if (event === 'reloading') {
      log(`${NETLIFYDEVLOG} ${chalk.magenta('Reloading')} function ${chalk.yellow(func?.displayName)}...`)

      return
    }

    if (event === 'removed') {
      log(`${NETLIFYDEVLOG} ${chalk.magenta('Removed')} function ${chalk.yellow(func?.displayName)}`)
    }
  }

  /**
   * Adds a function to the registry
   *
   * @param {string} name
   * @param {NetlifyFunction} funcBeforeHook
   * @param {boolean} [isReload]
   * @returns
   */
  async registerFunction(name, funcBeforeHook, isReload = false) {
    const { runtime } = funcBeforeHook

    // The `onRegister` hook allows runtimes to modify the function before it's
    // registered, or to prevent it from being registered altogether if the
    // hook returns `null`.
    const func = typeof runtime.onRegister === 'function' ? runtime.onRegister(funcBeforeHook) : funcBeforeHook

    if (func === null) {
      return
    }

    if (func.isBackground && this.isConnected && !this.capabilities.backgroundFunctions) {
      warn(BACKGROUND_FUNCTIONS_WARNING)
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
        FunctionsRegistry.logEvent('extracted', { func })
      }

      func.mainFile = join(unzippedDirectory, `${func.name}.js`)
    }

    this.functions.set(name, func)

    this.buildFunctionAndWatchFiles(func, !isReload)
  }

  /**
   * A proxy to zip-it-and-ship-it's `listFunctions` method. It exists just so
   * that we can mock it in tests.
   * @param  {Parameters<listFunctions>} args
   * @returns
   */
  // eslint-disable-next-line class-methods-use-this
  async listFunctions(...args) {
    return await listFunctions(...args)
  }

  /**
   * Takes a list of directories and scans for functions. It keeps tracks of
   * any functions in those directories that we've previously seen, and takes
   * care of registering and unregistering functions as they come and go.
   *
   * @param {string[]} relativeDirs
   */
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
        (newFunc) => newFunc.name === oldFunc.name && newFunc.mainFile === oldFunc.mainFile,
      )

      return !isFound
    })

    await Promise.all(deletedFunctions.map((func) => this.unregisterFunction(func)))

    const deletedFunctionNames = new Set(deletedFunctions.map((func) => func.name))
    const addedFunctions = await Promise.all(
      // zip-it-and-ship-it returns an array sorted based on which extension should have precedence,
      // where the last ones precede the previous ones. This is why
      // we reverse the array so we get the right functions precedence in the CLI.
      functions.reverse().map(async ({ displayName, mainFile, name, runtime: runtimeName }) => {
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

        // If a function we're registering was also unregistered in this run,
        // then it was a rename. Let's flag it as such so that the messaging
        // is adjusted accordingly.
        const isReload = deletedFunctionNames.has(name)

        await this.registerFunction(name, func, isReload)

        return func
      }),
    )
    const addedFunctionNames = new Set(addedFunctions.filter(Boolean).map((func) => func?.name))

    deletedFunctions.forEach((func) => {
      // If a function we've unregistered was also registered in this run, then
      // it was a rename that we've already logged. Nothing to do in this case.
      if (addedFunctionNames.has(func.name)) {
        return
      }

      FunctionsRegistry.logEvent('removed', { func })
    })

    await Promise.all(directories.map((path) => this.setupDirectoryWatcher(path)))
  }

  /**
   * Creates a watcher that looks at files being added or removed from a
   * functions directory. It doesn't care about files being changed, because
   * those will be handled by each functions' watcher.
   *
   * @param {string} directory
   */
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

  /**
   * Removes a function from the registry and closes its file watchers.
   *
   * @param {NetlifyFunction} func
   */
  async unregisterFunction(func) {
    const { name } = func

    this.functions.delete(name)

    const watcher = this.functionWatchers.get(name)

    if (watcher) {
      await watcher.close()
    }

    this.functionWatchers.delete(name)
  }

  /**
   * Takes a zipped function and extracts its contents to an internal directory.
   *
   * @param {NetlifyFunction} func
   */
  async unzipFunction(func) {
    const targetDirectory = resolve(
      this.projectRoot,
      getPathInProject([SERVE_FUNCTIONS_FOLDER, '.unzipped', func.name]),
    )

    await extractZip(func.mainFile, { dir: targetDirectory })

    return targetDirectory
  }
}
