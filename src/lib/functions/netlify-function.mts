// @ts-check
const CronParser = require('cron-parser')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'errorExit'... Remove this comment to see the full error message
const { error: errorExit } = require('../../utils/command-helpers.cjs')

const BACKGROUND_SUFFIX = '-background'

// Returns a new set with all elements of `setA` that don't exist in `setB`.
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const difference = (setA: $TSFixMe, setB: $TSFixMe) => new Set([...setA].filter((item) => !setB.has(item)))

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const getNextRun = function (schedule: $TSFixMe) {
  const cron = CronParser.parseExpression(schedule, {
    tz: 'Etc/UTC',
  })
  return cron.next().toDate()
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'NetlifyFun... Remove this comment to see the full error message
class NetlifyFunction {
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  buildData: $TSFixMe;
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  buildQueue: $TSFixMe;
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  config: $TSFixMe;
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  directory: $TSFixMe;
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  errorExit: $TSFixMe;
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  isBackground: $TSFixMe;
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  mainFile: $TSFixMe;
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  name: $TSFixMe;
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  projectRoot: $TSFixMe;
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  runtime: $TSFixMe;
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  schedule: $TSFixMe;
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  settings: $TSFixMe;
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  srcFiles: $TSFixMe;
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  timeoutBackground: $TSFixMe;
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  timeoutSynchronous: $TSFixMe;
  constructor({
    config,
    directory,
    mainFile,
    name,
    projectRoot,
    runtime,
    settings,
    timeoutBackground,
    timeoutSynchronous
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  }: $TSFixMe) {
    this.config = config
    this.directory = directory
    this.errorExit = errorExit
    this.mainFile = mainFile
    this.name = name
    this.projectRoot = projectRoot
    this.runtime = runtime
    this.timeoutBackground = timeoutBackground
    this.timeoutSynchronous = timeoutSynchronous
    this.settings = settings

    // Determines whether this is a background function based on the function
    // name.
    this.isBackground = name.endsWith(BACKGROUND_SUFFIX)

    const functionConfig = config.functions && config.functions[name]
    this.schedule = functionConfig && functionConfig.schedule

    // List of the function's source files. This starts out as an empty set
    // and will get populated on every build.
    this.srcFiles = new Set()
  }

  hasValidName() {
    // same as https://github.com/netlify/bitballoon/blob/fbd7881e6c8e8c48e7a0145da4ee26090c794108/app/models/deploy.rb#L482
    // eslint-disable-next-line unicorn/better-regex
    return /^[A-Za-z0-9_-]+$/.test(this.name);
  }

  async isScheduled() {
    await this.buildQueue

    return Boolean(this.schedule)
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
  async build({
    cache
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  }: $TSFixMe) {
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
      const srcFilesSet = new Set(srcFiles)
      const srcFilesDiff = this.getSrcFilesDiff(srcFilesSet)

      this.buildData = buildData
      this.srcFiles = srcFilesSet
      this.schedule = schedule || this.schedule

      return { includedFiles, srcFilesDiff }
    } catch (error) {
      return { error }
    }
  }

  // Compares a new set of source files against a previous one, returning an
  // object with two Sets, one with added and the other with deleted files.
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  getSrcFilesDiff(newSrcFiles: $TSFixMe) {
    const added = difference(newSrcFiles, this.srcFiles)
    const deleted = difference(this.srcFiles, newSrcFiles)

    return {
      added,
      deleted,
    }
  }

  // Invokes the function and returns its response object.
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  async invoke(event: $TSFixMe, context: $TSFixMe) {
    await this.buildQueue

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

module.exports = { NetlifyFunction }
