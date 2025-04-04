import { mkdir, stat } from 'fs/promises'
import { createRequire } from 'module'
import { basename, extname, isAbsolute, join, resolve } from 'path'
import { env } from 'process'

import { type ListedFunction, listFunctions, type Manifest } from '@netlify/zip-it-and-ship-it'
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
  type NormalizedCachedConfigConfig,
} from '../../utils/command-helpers.js'
import { getFrameworksAPIPaths } from '../../utils/frameworks-api.js'
import { INTERNAL_FUNCTIONS_FOLDER, SERVE_FUNCTIONS_FOLDER } from '../../utils/functions/functions.js'
import type { BlobsContextWithEdgeAccess } from '../blobs/blobs.js'
import { BACKGROUND_FUNCTIONS_WARNING } from '../log.js'
import { getPathInProject } from '../settings.js'
import type { ServerSettings } from '../../utils/types.js'

import NetlifyFunction from './netlify-function.js'
import runtimes, { type BaseBuildResult } from './runtimes/index.js'
import type { BuildCommandCache } from './memoized-build.js'

export const DEFAULT_FUNCTION_URL_EXPRESSION = /^\/.netlify\/(functions|builders)\/([^/]+).*/
const TYPES_PACKAGE = '@netlify/functions'
const ZIP_EXTENSION = '.zip'

const isInternalFunction = (
  func: ListedFunction | NetlifyFunction<BaseBuildResult>,
  frameworksAPIFunctionsPath: string,
) =>
  func.mainFile.includes(getPathInProject([INTERNAL_FUNCTIONS_FOLDER])) ||
  func.mainFile.includes(frameworksAPIFunctionsPath)

export class FunctionsRegistry {
  /**
   * The functions held by the registry
   */
  private functions = new Map<string, NetlifyFunction<BaseBuildResult>>()

  /**
   * File watchers for function files. Maps function names to objects built
   * by the `watchDebounced` utility.
   */
  private functionWatchers = new Map<string, Awaited<ReturnType<typeof watchDebounced>>>()

  private directoryWatchers: Map<string, Awaited<ReturnType<typeof watchDebounced>>>

  /**
   * Keeps track of whether we've checked whether `TYPES_PACKAGE` is
   * installed.
   */
  private hasCheckedTypesPackage = false

  /**
   * Context object for Netlify Blobs
   */
  private blobsContext: BlobsContextWithEdgeAccess

  private buildCommandCache?: BuildCommandCache<Record<string, unknown>>
  private capabilities: {
    backgroundFunctions?: boolean
  }
  private config: NormalizedCachedConfigConfig
  private debug: boolean
  private frameworksAPIPaths: ReturnType<typeof getFrameworksAPIPaths>
  private isConnected: boolean
  private logLambdaCompat: boolean
  private manifest?: Manifest
  private projectRoot: string
  // TODO(serhalp) This is confusing. Refactor to accept entire settings or rename or something?
  private settings: Pick<ServerSettings, 'functions' | 'functionsPort'>
  private timeouts: { backgroundFunctions: number; syncFunctions: number }

  constructor({
    blobsContext,
    capabilities,
    config,
    debug = false,
    frameworksAPIPaths,
    isConnected = false,
    logLambdaCompat,
    manifest,
    projectRoot,
    settings,
    timeouts,
  }: {
    blobsContext: BlobsContextWithEdgeAccess
    buildCache?: Record<string, unknown>
    capabilities: {
      backgroundFunctions?: boolean
    }
    config: NormalizedCachedConfigConfig
    debug?: boolean
    frameworksAPIPaths: ReturnType<typeof getFrameworksAPIPaths>
    isConnected?: boolean
    logLambdaCompat: boolean
    manifest?: Manifest
    projectRoot: string
    // TODO(serhalp) This is confusing. Refactor to accept entire settings or rename or something?
    settings: Pick<ServerSettings, 'functions' | 'functionsPort'>
    timeouts: { backgroundFunctions: number; syncFunctions: number }
  }) {
    this.capabilities = capabilities
    this.config = config
    this.debug = debug
    this.frameworksAPIPaths = frameworksAPIPaths
    this.isConnected = isConnected
    this.projectRoot = projectRoot
    this.timeouts = timeouts
    this.settings = settings
    this.blobsContext = blobsContext

    /**
     * An object to be shared among all functions in the registry. It can be
     * used to cache the results of the build function — e.g. it's used in
     * the `memoizedBuild` method in the JavaScript runtime.
     */
    this.buildCommandCache = {}

    /**
     * File watchers for parent directories where functions live — i.e. the
     * ones supplied to `scan()`. This is a Map because in the future we
     * might have several function directories.
     */
    this.directoryWatchers = new Map()

    /**
     * Whether to log V1 functions as using the "Lambda compatibility mode"
     *
     */
    this.logLambdaCompat = Boolean(logLambdaCompat)

    /**
     * Contents of a `manifest.json` file that can be looked up when dealing
     * with built functions.
     *
     */
    this.manifest = manifest
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
      if (error != null && typeof error === 'object' && 'code' in error && error.code === 'MODULE_NOT_FOUND') {
        this.logEvent('missing-types-package', {})
      }
    }
  }

  /**
   * Runs before `scan` and calls any `onDirectoryScan` hooks defined by the
   * runtime before the directory is read. This gives runtime the opportunity
   * to run additional logic when a directory is scanned.
   */
  static async prepareDirectoryScan(directory: string) {
    await mkdir(directory, { recursive: true })

    // We give runtimes the opportunity to react to a directory scan and run
    // additional logic before the directory is read. So if they implement a
    // `onDirectoryScan` hook, we run it.
    await Promise.all(
      Object.values(runtimes).map((runtime) => {
        if (!('onDirectoryScan' in runtime)) {
          return null
        }

        return runtime.onDirectoryScan({ directory })
      }),
    )
  }

  /**
   * Builds a function and sets up the appropriate file watchers so that any
   * changes will trigger another build.
   */
  async buildFunctionAndWatchFiles(func: NetlifyFunction<BaseBuildResult>, firstLoad = false) {
    if (!firstLoad) {
      this.logEvent('reloading', { func })
    }

    const { error: buildError, includedFiles, srcFilesDiff } = await func.build({ cache: this.buildCommandCache })

    if (buildError) {
      this.logEvent('buildError', { func })
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

        this.logEvent(event, { func, warnings: [warning] })
      } else {
        this.logEvent(event, { func })
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
   */
  get(name: string) {
    return this.functions.get(name)
  }

  /**
   * Looks for the first function that matches a given URL path. If a match is
   * found, returns an object with the function and the route. If the URL path
   * matches the default functions URL (i.e. can only be for a function) but no
   * function with the given name exists, returns an object with the function
   * and the route set to `null`. Otherwise, `undefined` is returned,
   */
  async getFunctionForURLPath(urlPath: string, method: string, hasStaticFile: () => Promise<boolean>) {
    // We're constructing a URL object just so that we can extract the path from
    // the incoming URL. It doesn't really matter that we don't have the actual
    // local URL with the correct port.
    const url = new URL(`http://localhost${urlPath}`)
    const defaultURLMatch = DEFAULT_FUNCTION_URL_EXPRESSION.exec(url.pathname)

    if (defaultURLMatch) {
      const func = this.get(defaultURLMatch[2])

      if (!func) {
        return { func: null, route: null }
      }

      const { routes = [] } = (await func.getBuildData()) ?? {}

      if (routes.length !== 0) {
        const paths = routes.map((route) => chalk.underline(route.pattern)).join(', ')

        warn(
          `Function ${chalk.yellow(func.name)} cannot be invoked on ${chalk.underline(
            url.pathname,
          )}, because the function has the following URL paths defined: ${paths}`,
        )

        return
      }

      return { func, route: null }
    }

    for (const func of this.functions.values()) {
      const route = await func.matchURLPath(url.pathname, method, hasStaticFile)

      if (route) {
        return { func, route }
      }
    }
  }

  /**
   * Logs an event associated with functions.
   */
  private logEvent(
    event: 'buildError' | 'extracted' | 'loaded' | 'missing-types-package' | 'reloaded' | 'reloading' | 'removed',
    { func, warnings = [] }: { func?: NetlifyFunction<BaseBuildResult>; warnings?: string[] },
  ) {
    let warningsText = ''

    if (warnings.length !== 0) {
      warningsText = ` with warnings:\n${warnings.map((warning) => `  - ${warning}`).join('\n')}`
    }

    if (event === 'buildError') {
      log(
        `${NETLIFYDEVERR} ${chalk.red('Failed to load')} function ${chalk.yellow(func?.displayName)}: ${
          func?.buildError?.message ?? ''
        }`,
      )
    }

    if (event === 'extracted') {
      log(
        `${NETLIFYDEVLOG} ${chalk.green('Extracted')} function ${chalk.yellow(func?.displayName)} from ${
          func?.mainFile ?? ''
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
        )} package. Refer to https://ntl.fyi/function-types for more information.`,
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
   */
  async registerFunction(name: string, funcBeforeHook: NetlifyFunction<BaseBuildResult>, isReload = false) {
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

      // If there's a manifest file, look up the function in order to extract the build data.
      const manifestEntry = (this.manifest?.functions ?? []).find((manifestFunc) => manifestFunc.name === func.name)

      // We found a zipped function that does not have a corresponding entry in
      // the manifest. This shouldn't happen, but we ignore the function in
      // this case.
      if (!manifestEntry) {
        return
      }

      if (this.debug) {
        this.logEvent('extracted', { func })
      }

      func.buildData = {
        ...manifestEntry.buildData,
        routes: manifestEntry.routes,
      }

      // When we look at an unzipped function, we don't know whether it uses
      // the legacy entry file format (i.e. `[function name].mjs`) or the new
      // one (i.e. `___netlify-entry-point.mjs`). Let's look for the new one
      // and use it if it exists, otherwise use the old one.
      try {
        const v2EntryPointPath = join(unzippedDirectory, '___netlify-entry-point.mjs')

        await stat(v2EntryPointPath)

        func.mainFile = v2EntryPointPath
      } catch {
        func.mainFile = join(unzippedDirectory, basename(manifestEntry.mainFile))
      }
    } else {
      this.buildFunctionAndWatchFiles(func, !isReload)
    }

    this.functions.set(name, func)
  }

  /**
   * A proxy to zip-it-and-ship-it's `listFunctions` method. It exists just so
   * that we can mock it in tests.
   */
  async listFunctions(...args: Parameters<typeof listFunctions>) {
    return await listFunctions(...args)
  }

  /**
   * Takes a list of directories and scans for functions. It keeps tracks of
   * any functions in those directories that we've previously seen, and takes
   * care of registering and unregistering functions as they come and go.
   */
  async scan(relativeDirs: (string | undefined)[]) {
    const directories = relativeDirs
      .filter((dir): dir is string => Boolean(dir))
      .map((dir) => (isAbsolute(dir) ? dir : join(this.projectRoot, dir)))

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
      // @ts-expect-error -- TODO(serhalp) Function config types do not match. Investigate and fix.
      config: this.config.functions,
    })

    // user-defined functions take precedence over internal functions,
    // so we want to ignore any internal functions where there's a user-defined one with the same name
    const ignoredFunctions = new Set(
      functions
        .filter(
          (func) =>
            isInternalFunction(func, this.frameworksAPIPaths.functions.path) &&
            this.functions.has(func.name) &&
            !isInternalFunction(this.functions.get(func.name)!, this.frameworksAPIPaths.functions.path),
        )
        .map((func) => func.name),
    )

    // Before registering any functions, we look for any functions that were on
    // the previous list but are missing from the new one. We unregister them.
    const deletedFunctions = [...this.functions.values()].filter((oldFunc) => {
      const isFound = functions.some(
        (newFunc) =>
          ignoredFunctions.has(newFunc.name) ||
          (newFunc.name === oldFunc.name && newFunc.mainFile === oldFunc.mainFile),
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
        if (ignoredFunctions.has(name)) {
          return
        }

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
          blobsContext: this.blobsContext,
          config: this.config,
          directory: directories.find((directory) => mainFile.startsWith(directory)),
          mainFile,
          name,
          displayName,
          projectRoot: this.projectRoot,
          // @ts-expect-error(serhalp) -- I think TS needs to know that a given instance of `runtime` in this loop at
          // this point will have a refined type of only one of the runtime types in the union, and this type is
          // consistent between the `NetlifyFunction` and the `runtime`. But... how do?
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

      this.logEvent('removed', { func })
    })

    await Promise.all(directories.map((path) => this.setupDirectoryWatcher(path)))
  }

  /**
   * Creates a watcher that looks at files being added or removed from a
   * functions directory. It doesn't care about files being changed, because
   * those will be handled by each functions' watcher.
   */
  async setupDirectoryWatcher(directory: string) {
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
   */
  async unregisterFunction(func: NetlifyFunction<BaseBuildResult>) {
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
   */
  async unzipFunction(func: NetlifyFunction<BaseBuildResult>) {
    const targetDirectory = resolve(
      this.projectRoot,
      getPathInProject([SERVE_FUNCTIONS_FOLDER, '.unzipped', func.name]),
    )

    await extractZip(func.mainFile, { dir: targetDirectory })

    return targetDirectory
  }
}
