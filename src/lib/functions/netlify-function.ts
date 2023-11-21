import { Buffer } from 'buffer'
import { basename, extname } from 'path'
import { version as nodeVersion } from 'process'

import CronParser from 'cron-parser'
import semver from 'semver'

import { error as errorExit } from '../../utils/command-helpers.js'
import { BACKGROUND } from '../../utils/functions/get-functions.js'

const TYPESCRIPT_EXTENSIONS = new Set(['.cts', '.mts', '.ts'])
const V2_MIN_NODE_VERSION = '18.14.0'

// Returns a new set with all elements of `setA` that don't exist in `setB`.
// @ts-expect-error TS(7006) FIXME: Parameter 'setA' implicitly has an 'any' type.
const difference = (setA, setB) => new Set([...setA].filter((item) => !setB.has(item)))

// @ts-expect-error TS(7006) FIXME: Parameter 'schedule' implicitly has an 'any' type.
const getNextRun = function (schedule) {
  const cron = CronParser.parseExpression(schedule, {
    tz: 'Etc/UTC',
  })
  return cron.next().toDate()
}

export default class NetlifyFunction {
  constructor({
    // @ts-expect-error TS(7031) FIXME: Binding element 'blobsContext' implicitly has an '... Remove this comment to see the full error message
    blobsContext,
    // @ts-expect-error TS(7031) FIXME: Binding element 'config' implicitly has an 'any' t... Remove this comment to see the full error message
    config,
    // @ts-expect-error TS(7031) FIXME: Binding element 'directory' implicitly has an 'any... Remove this comment to see the full error message
    directory,
    // @ts-expect-error TS(7031) FIXME: Binding element 'displayName' implicitly has an 'a... Remove this comment to see the full error message
    displayName,
    // @ts-expect-error TS(7031) FIXME: Binding element 'mainFile' implicitly has an 'any'... Remove this comment to see the full error message
    mainFile,
    // @ts-expect-error TS(7031) FIXME: Binding element 'name' implicitly has an 'any' typ... Remove this comment to see the full error message
    name,
    // @ts-expect-error TS(7031) FIXME: Binding element 'projectRoot' implicitly has an 'a... Remove this comment to see the full error message
    projectRoot,
    // @ts-expect-error TS(7031) FIXME: Binding element 'runtime' implicitly has an 'any' ... Remove this comment to see the full error message
    runtime,
    // @ts-expect-error TS(7031) FIXME: Binding element 'settings' implicitly has an 'any'... Remove this comment to see the full error message
    settings,
    // @ts-expect-error TS(7031) FIXME: Binding element 'timeoutBackground' implicitly has... Remove this comment to see the full error message
    timeoutBackground,
    // @ts-expect-error TS(7031) FIXME: Binding element 'timeoutSynchronous' implicitly ha... Remove this comment to see the full error message
    timeoutSynchronous,
  }) {
    // @ts-expect-error TS(2339) FIXME: Property 'blobsContext' does not exist on type 'Ne... Remove this comment to see the full error message
    this.blobsContext = blobsContext
    // @ts-expect-error TS(2339) FIXME: Property 'buildError' does not exist on type 'Netl... Remove this comment to see the full error message
    this.buildError = null
    // @ts-expect-error TS(2339) FIXME: Property 'config' does not exist on type 'NetlifyF... Remove this comment to see the full error message
    this.config = config
    // @ts-expect-error TS(2339) FIXME: Property 'directory' does not exist on type 'Netli... Remove this comment to see the full error message
    this.directory = directory
    // @ts-expect-error TS(2339) FIXME: Property 'errorExit' does not exist on type 'Netli... Remove this comment to see the full error message
    this.errorExit = errorExit
    // @ts-expect-error TS(2339) FIXME: Property 'mainFile' does not exist on type 'Netlif... Remove this comment to see the full error message
    this.mainFile = mainFile
    // @ts-expect-error TS(2339) FIXME: Property 'name' does not exist on type 'NetlifyFun... Remove this comment to see the full error message
    this.name = name
    // @ts-expect-error TS(2339) FIXME: Property 'displayName' does not exist on type 'Net... Remove this comment to see the full error message
    this.displayName = displayName ?? name
    // @ts-expect-error TS(2339) FIXME: Property 'projectRoot' does not exist on type 'Net... Remove this comment to see the full error message
    this.projectRoot = projectRoot
    // @ts-expect-error TS(2339) FIXME: Property 'runtime' does not exist on type 'Netlify... Remove this comment to see the full error message
    this.runtime = runtime
    // @ts-expect-error TS(2339) FIXME: Property 'timeoutBackground' does not exist on typ... Remove this comment to see the full error message
    this.timeoutBackground = timeoutBackground
    // @ts-expect-error TS(2339) FIXME: Property 'timeoutSynchronous' does not exist on ty... Remove this comment to see the full error message
    this.timeoutSynchronous = timeoutSynchronous
    // @ts-expect-error TS(2339) FIXME: Property 'settings' does not exist on type 'Netlif... Remove this comment to see the full error message
    this.settings = settings

    // Determines whether this is a background function based on the function
    // name.
    // @ts-expect-error TS(2339) FIXME: Property 'isBackground' does not exist on type 'Ne... Remove this comment to see the full error message
    this.isBackground = name.endsWith(BACKGROUND)

    const functionConfig = config.functions && config.functions[name]
    // @ts-expect-error TS(2339) FIXME: Property 'schedule' does not exist on type 'Netlif... Remove this comment to see the full error message
    this.schedule = functionConfig && functionConfig.schedule

    // List of the function's source files. This starts out as an empty set
    // and will get populated on every build.
    // @ts-expect-error TS(2339) FIXME: Property 'srcFiles' does not exist on type 'Netlif... Remove this comment to see the full error message
    this.srcFiles = new Set()
  }

  get filename() {
    // @ts-expect-error TS(2339) FIXME: Property 'buildData' does not exist on type 'Netli... Remove this comment to see the full error message
    if (!this.buildData?.mainFile) {
      return null
    }

    // @ts-expect-error TS(2339) FIXME: Property 'buildData' does not exist on type 'Netli... Remove this comment to see the full error message
    return basename(this.buildData.mainFile)
  }

  getRecommendedExtension() {
    // @ts-expect-error TS(2339) FIXME: Property 'buildData' does not exist on type 'Netli... Remove this comment to see the full error message
    if (this.buildData?.runtimeAPIVersion !== 2) {
      return
    }

    // @ts-expect-error TS(2339) FIXME: Property 'buildData' does not exist on type 'Netli... Remove this comment to see the full error message
    const extension = this.buildData?.mainFile ? extname(this.buildData.mainFile) : undefined
    // @ts-expect-error TS(2339) FIXME: Property 'buildData' does not exist on type 'Netli... Remove this comment to see the full error message
    const moduleFormat = this.buildData?.outputModuleFormat

    if (moduleFormat === 'esm') {
      return
    }

    if (extension === '.ts') {
      return '.mts'
    }

    if (extension === '.js') {
      return '.js'
    }
  }

  hasValidName() {
    // same as https://github.com/netlify/bitballoon/blob/fbd7881e6c8e8c48e7a0145da4ee26090c794108/app/models/deploy.rb#L482
    // @ts-expect-error TS(2339) FIXME: Property 'name' does not exist on type 'NetlifyFun... Remove this comment to see the full error message
    // eslint-disable-next-line unicorn/better-regex
    return /^[A-Za-z0-9_-]+$/.test(this.name)
  }

  async isScheduled() {
    // @ts-expect-error TS(2339) FIXME: Property 'buildQueue' does not exist on type 'Netl... Remove this comment to see the full error message
    await this.buildQueue

    // @ts-expect-error TS(2339) FIXME: Property 'schedule' does not exist on type 'Netlif... Remove this comment to see the full error message
    return Boolean(this.schedule)
  }

  isSupported() {
    // @ts-expect-error TS(2339) FIXME: Property 'buildData' does not exist on type 'Netli... Remove this comment to see the full error message
    return !(this.buildData?.runtimeAPIVersion === 2 && semver.lt(nodeVersion, V2_MIN_NODE_VERSION))
  }

  isTypeScript() {
    if (this.filename === null) {
      return false
    }

    return TYPESCRIPT_EXTENSIONS.has(extname(this.filename))
  }

  async getNextRun() {
    if (!(await this.isScheduled())) {
      return null
    }

    // @ts-expect-error TS(2339) FIXME: Property 'schedule' does not exist on type 'Netlif... Remove this comment to see the full error message
    return getNextRun(this.schedule)
  }

  // The `build` method transforms source files into invocable functions. Its
  // return value is an object with:
  //
  // - `srcFilesDiff`: Files that were added and removed since the last time
  //    the function was built.
  // @ts-expect-error TS(7031) FIXME: Binding element 'cache' implicitly has an 'any' ty... Remove this comment to see the full error message
  async build({ cache }) {
    // @ts-expect-error TS(2339) FIXME: Property 'runtime' does not exist on type 'Netlify... Remove this comment to see the full error message
    const buildFunction = await this.runtime.getBuildFunction({
      // @ts-expect-error TS(2339) FIXME: Property 'config' does not exist on type 'NetlifyF... Remove this comment to see the full error message
      config: this.config,
      // @ts-expect-error TS(2339) FIXME: Property 'directory' does not exist on type 'Netli... Remove this comment to see the full error message
      directory: this.directory,
      // @ts-expect-error TS(2339) FIXME: Property 'errorExit' does not exist on type 'Netli... Remove this comment to see the full error message
      errorExit: this.errorExit,
      func: this,
      // @ts-expect-error TS(2339) FIXME: Property 'projectRoot' does not exist on type 'Net... Remove this comment to see the full error message
      projectRoot: this.projectRoot,
    })

    // @ts-expect-error TS(2339) FIXME: Property 'buildQueue' does not exist on type 'Netl... Remove this comment to see the full error message
    this.buildQueue = buildFunction({ cache })

    try {
      // @ts-expect-error TS(2339) FIXME: Property 'buildQueue' does not exist on type 'Netl... Remove this comment to see the full error message
      const { includedFiles = [], schedule, srcFiles, ...buildData } = await this.buildQueue
      const srcFilesSet = new Set(srcFiles)
      const srcFilesDiff = this.getSrcFilesDiff(srcFilesSet)

      // @ts-expect-error TS(2339) FIXME: Property 'buildData' does not exist on type 'Netli... Remove this comment to see the full error message
      this.buildData = buildData
      // @ts-expect-error TS(2339) FIXME: Property 'buildError' does not exist on type 'Netl... Remove this comment to see the full error message
      this.buildError = null
      // @ts-expect-error TS(2339) FIXME: Property 'srcFiles' does not exist on type 'Netlif... Remove this comment to see the full error message
      this.srcFiles = srcFilesSet
      // @ts-expect-error TS(2339) FIXME: Property 'schedule' does not exist on type 'Netlif... Remove this comment to see the full error message
      this.schedule = schedule || this.schedule

      if (!this.isSupported()) {
        throw new Error(
          `Function requires Node.js version ${V2_MIN_NODE_VERSION} or above, but ${nodeVersion.slice(
            1,
          )} is installed. Refer to https://ntl.fyi/functions-runtime for information on how to update.`,
        )
      }

      return { includedFiles, srcFilesDiff }
    } catch (error) {
      // @ts-expect-error TS(2339) FIXME: Property 'buildError' does not exist on type 'Netl... Remove this comment to see the full error message
      this.buildError = error

      return { error }
    }
  }

  async getBuildData() {
    // @ts-expect-error TS(2339) FIXME: Property 'buildQueue' does not exist on type 'Netl... Remove this comment to see the full error message
    await this.buildQueue

    // @ts-expect-error TS(2339) FIXME: Property 'buildData' does not exist on type 'Netli... Remove this comment to see the full error message
    return this.buildData
  }

  // Compares a new set of source files against a previous one, returning an
  // object with two Sets, one with added and the other with deleted files.
  // @ts-expect-error TS(7006) FIXME: Parameter 'newSrcFiles' implicitly has an 'any' ty... Remove this comment to see the full error message
  getSrcFilesDiff(newSrcFiles) {
    // @ts-expect-error TS(2339) FIXME: Property 'srcFiles' does not exist on type 'Netlif... Remove this comment to see the full error message
    const added = difference(newSrcFiles, this.srcFiles)
    // @ts-expect-error TS(2339) FIXME: Property 'srcFiles' does not exist on type 'Netlif... Remove this comment to see the full error message
    const deleted = difference(this.srcFiles, newSrcFiles)

    return {
      added,
      deleted,
    }
  }

  // Invokes the function and returns its response object.
  async invoke(event = {}, context = {}) {
    // @ts-expect-error TS(2339) FIXME: Property 'buildQueue' does not exist on type 'Netl... Remove this comment to see the full error message
    await this.buildQueue

    // @ts-expect-error TS(2339) FIXME: Property 'buildError' does not exist on type 'Netl... Remove this comment to see the full error message
    if (this.buildError) {
      // @ts-expect-error TS(2339) FIXME: Property 'buildError' does not exist on type 'Netl... Remove this comment to see the full error message
      return { result: null, error: { errorMessage: this.buildError.message } }
    }

    // @ts-expect-error TS(2339) FIXME: Property 'isBackground' does not exist on type 'Ne... Remove this comment to see the full error message
    const timeout = this.isBackground ? this.timeoutBackground : this.timeoutSynchronous
    const environment = {}

    // @ts-expect-error TS(2339) FIXME: Property 'blobsContext' does not exist on type 'Ne... Remove this comment to see the full error message
    if (this.blobsContext) {
      const payload = JSON.stringify({
        // @ts-expect-error TS(2339) FIXME: Property 'blobsContext' does not exist on type 'Ne... Remove this comment to see the full error message
        url: this.blobsContext.edgeURL,
        // @ts-expect-error TS(2339) FIXME: Property 'blobsContext' does not exist on type 'Ne... Remove this comment to see the full error message
        token: this.blobsContext.token,
      })

      // @ts-expect-error TS(2339) FIXME: Property 'blobs' does not exist on type '{}'.
      event.blobs = Buffer.from(payload).toString('base64')
    }

    try {
      // @ts-expect-error TS(2339) FIXME: Property 'runtime' does not exist on type 'Netlify... Remove this comment to see the full error message
      const result = await this.runtime.invokeFunction({
        context,
        environment,
        event,
        func: this,
        timeout,
      })
      return { result, error: null }
    } catch (error) {
      return { result: null, error }
    }
  }

  /**
   * Matches all routes agains the incoming request. If a match is found, then the matched route is returned.
   * @param {string} rawPath
   * @param {string} method
   * @returns matched route
   */
  // @ts-expect-error TS(7006) FIXME: Parameter 'rawPath' implicitly has an 'any' type.
  async matchURLPath(rawPath, method) {
    // @ts-expect-error TS(2339) FIXME: Property 'buildQueue' does not exist on type 'Netl... Remove this comment to see the full error message
    await this.buildQueue

    let path = rawPath !== '/' && rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath
    path = path.toLowerCase()
    // @ts-expect-error TS(2339) FIXME: Property 'buildData' does not exist on type 'Netli... Remove this comment to see the full error message
    const { routes = [] } = this.buildData
    // @ts-expect-error TS(7031) FIXME: Binding element 'expression' implicitly has an 'an... Remove this comment to see the full error message
    return routes.find(({ expression, literal, methods }) => {
      if (methods.length !== 0 && !methods.includes(method)) {
        return false
      }

      if (literal !== undefined) {
        return path === literal
      }

      if (expression !== undefined) {
        const regex = new RegExp(expression)

        return regex.test(path)
      }

      return false
    })
  }

  get runtimeAPIVersion() {
    // @ts-expect-error TS(2339) FIXME: Property 'buildData' does not exist on type 'Netli... Remove this comment to see the full error message
    return this.buildData?.runtimeAPIVersion ?? 1
  }

  get url() {
    // This line fixes the issue here https://github.com/netlify/cli/issues/4116
    // Not sure why `settings.port` was used here nor does a valid reference exist.
    // However, it remains here to serve whatever purpose for which it was added.
    // @ts-expect-error TS(2339) FIXME: Property 'settings' does not exist on type 'Netlif... Remove this comment to see the full error message
    const port = this.settings.port || this.settings.functionsPort
    // @ts-expect-error TS(2339) FIXME: Property 'settings' does not exist on type 'Netlif... Remove this comment to see the full error message
    const protocol = this.settings.https ? 'https' : 'http'
    // @ts-expect-error TS(2339) FIXME: Property 'name' does not exist on type 'NetlifyFun... Remove this comment to see the full error message
    const url = new URL(`/.netlify/functions/${this.name}`, `${protocol}://localhost:${port}`)

    return url.href
  }
}
