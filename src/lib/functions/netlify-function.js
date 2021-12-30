// @ts-check
const { error: errorExit } = require('../../utils/command-helpers')

const BACKGROUND_SUFFIX = '-background'

// Returns a new set with all elements of `setA` that don't exist in `setB`.
const difference = (setA, setB) => new Set([...setA].filter((item) => !setB.has(item)))

class NetlifyFunction {
  constructor({
    config,
    directory,
    mainFile,
    name,
    projectRoot,
    runtime,
    settings,
    timeoutBackground,
    timeoutSynchronous,
  }) {
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

    // List of the function's source files. This starts out as an empty set
    // and will get populated on every build.
    this.srcFiles = new Set()
  }

  hasValidName() {
    // same as https://github.com/netlify/bitballoon/blob/fbd7881e6c8e8c48e7a0145da4ee26090c794108/app/models/deploy.rb#L482
    // eslint-disable-next-line unicorn/better-regex
    return /^[A-Za-z0-9_-]+$/.test(this.name)
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
      const { srcFiles, ...buildData } = await this.buildQueue
      const srcFilesSet = new Set(srcFiles)
      const srcFilesDiff = this.getSrcFilesDiff(srcFilesSet)

      this.buildData = buildData
      this.srcFiles = srcFilesSet

      return { srcFilesDiff }
    } catch (error) {
      return { error }
    }
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
    return `http://localhost:${this.settings.port}/.netlify/functions/${this.name}`
  }
}

module.exports = { NetlifyFunction }
