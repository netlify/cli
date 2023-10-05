// @ts-check
import { basename, extname } from 'path'
import { version as nodeVersion } from 'process'

import CronParser from 'cron-parser'
import semver from 'semver'

import { error as errorExit } from '../../utils/command-helpers.mjs'
import { BACKGROUND } from '../../utils/functions/get-functions.mjs'

import { checkTsconfigForV2Api } from './check-tsconfig-for-v2-api.mjs'

const TYPESCRIPT_EXTENSIONS = new Set(['.cts', '.mts', '.ts'])
const V2_MIN_NODE_VERSION = '18.0.0'

// Returns a new set with all elements of `setA` that don't exist in `setB`.
const difference = (setA, setB) => new Set([...setA].filter((item) => !setB.has(item)))

const getNextRun = function (schedule) {
  const cron = CronParser.parseExpression(schedule, {
    tz: 'Etc/UTC',
  })
  return cron.next().toDate()
}

export default class NetlifyFunction {
  constructor({
    config,
    directory,
    displayName,
    mainFile,
    name,
    projectRoot,
    runtime,
    settings,
    timeoutBackground,
    timeoutSynchronous,
  }) {
    this.buildError = null
    this.config = config
    this.directory = directory
    this.errorExit = errorExit
    this.mainFile = mainFile
    this.name = name
    this.displayName = displayName ?? name
    this.projectRoot = projectRoot
    this.runtime = runtime
    this.timeoutBackground = timeoutBackground
    this.timeoutSynchronous = timeoutSynchronous
    this.settings = settings

    // Determines whether this is a background function based on the function
    // name.
    this.isBackground = name.endsWith(BACKGROUND)

    const functionConfig = config.functions && config.functions[name]
    this.schedule = functionConfig && functionConfig.schedule

    // List of the function's source files. This starts out as an empty set
    // and will get populated on every build.
    this.srcFiles = new Set()
  }

  get filename() {
    if (!this.buildData?.mainFile) {
      return null
    }

    return basename(this.buildData.mainFile)
  }

  getRecommendedExtension() {
    if (this.buildData?.runtimeAPIVersion !== 2) {
      return
    }

    const extension = this.buildData?.mainFile ? extname(this.buildData.mainFile) : undefined
    const moduleFormat = this.buildData?.outputModuleFormat

    if (moduleFormat === 'esm') {
      return
    }

    if (extension === '.ts') {
      return '.mts'
    }

    if (extension === '.js') {
      return '.mjs'
    }
  }

  hasValidName() {
    // same as https://github.com/netlify/bitballoon/blob/fbd7881e6c8e8c48e7a0145da4ee26090c794108/app/models/deploy.rb#L482
    // eslint-disable-next-line unicorn/better-regex
    return /^[A-Za-z0-9_-]+$/.test(this.name)
  }

  async isScheduled() {
    await this.buildQueue

    return Boolean(this.schedule)
  }

  isSupported() {
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

    return getNextRun(this.schedule)
  }

  // The `build` method transforms source files into invocable functions. Its
  // return value is an object with:
  //
  // - `srcFilesDiff`: Files that were added and removed since the last time
  //    the function was built.
  async build({ cache }) {
    const buildFunction = await this.runtime.getBuildFunction({
      config: this.config,
      directory: this.directory,
      errorExit: this.errorExit,
      func: this,
      projectRoot: this.projectRoot,
    })

    this.buildQueue = buildFunction({ cache })

    try {
      const { includedFiles = [], schedule, srcFiles, ...buildData } = await this.buildQueue

      if (buildData.runtimeAPIVersion === 2) {
        // Check f the tsconfig.json file exists for the editor support.
        // If not create it
        await checkTsconfigForV2Api({ functionsDir: this.directory })
      }

      const srcFilesSet = new Set(srcFiles)
      const srcFilesDiff = this.getSrcFilesDiff(srcFilesSet)

      this.buildData = buildData
      this.buildError = null
      this.srcFiles = srcFilesSet
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
      this.buildError = error

      return { error }
    }
  }

  async getBuildData() {
    await this.buildQueue

    return this.buildData
  }

  // Compares a new set of source files against a previous one, returning an
  // object with two Sets, one with added and the other with deleted files.
  getSrcFilesDiff(newSrcFiles) {
    const added = difference(newSrcFiles, this.srcFiles)
    const deleted = difference(this.srcFiles, newSrcFiles)

    return {
      added,
      deleted,
    }
  }

  // Invokes the function and returns its response object.
  async invoke(event, context) {
    await this.buildQueue

    if (this.buildError) {
      return { result: null, error: { errorMessage: this.buildError.message } }
    }

    const timeout = this.isBackground ? this.timeoutBackground : this.timeoutSynchronous

    try {
      const result = await this.runtime.invokeFunction({
        context,
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
  async matchURLPath(rawPath, method) {
    await this.buildQueue

    let path = rawPath !== '/' && rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath
    path = path.toLowerCase()
    const { routes = [] } = this.buildData
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
    return this.buildData?.runtimeAPIVersion ?? 1
  }

  get url() {
    // This line fixes the issue here https://github.com/netlify/cli/issues/4116
    // Not sure why `settings.port` was used here nor does a valid reference exist.
    // However, it remains here to serve whatever purpose for which it was added.
    const port = this.settings.port || this.settings.functionsPort
    const protocol = this.settings.https ? 'https' : 'http'
    const url = new URL(`/.netlify/functions/${this.name}`, `${protocol}://localhost:${port}`)

    return url.href
  }
}
