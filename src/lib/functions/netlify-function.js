const { Mutex, withTimeout } = require('async-mutex')

const { difference } = require('../../utils/difference')

const BACKGROUND_SUFFIX = '-background'

// 3 minutes
const MUTEX_TIMEOUT = 18e4

class NetlifyFunction {
  constructor({
    config,
    errorExit,
    functionsDirectory,
    mainFile,
    name,
    projectRoot,
    runtime,
    timeoutBackground,
    timeoutSynchronous,
  }) {
    this.config = config
    this.errorExit = errorExit
    this.functionsDirectory = functionsDirectory
    this.mainFile = mainFile
    this.name = name
    this.projectRoot = projectRoot
    this.runtime = runtime
    this.timeoutBackground = timeoutBackground
    this.timeoutSynchronous = timeoutSynchronous

    // Determines whether this is a background function based on the function
    // name.
    this.isBackground = name.endsWith(BACKGROUND_SUFFIX)

    // List of the function's source files. This starts out as an empty set
    // and will get populated on every build.
    this.srcFiles = new Set()
    this.mutex = withTimeout(new Mutex(), MUTEX_TIMEOUT)
  }

  // The `build` method transforms source files into invocable functions. Its
  // return value is an object with:
  //
  // - `srcFilesDiff`: Files that were added and removed since the last time
  //    the function was built.
  async build({ cache }) {
    try {
      return await this.mutex.runExclusive(async () => {
        const buildFunction = await this.runtime.getBuildFunction({
          config: this.config,
          errorExit: this.errorExit,
          func: this,
          functionsDirectory: this.functionsDirectory,
          projectRoot: this.projectRoot,
        })

        try {
          const { srcFiles, ...buildData } = await buildFunction({ cache })
          const srcFilesSet = new Set(srcFiles)
          const srcFilesDiff = this.getSrcFilesDiff(srcFilesSet)

          this.buildData = buildData
          this.srcFiles = srcFilesSet

          return { srcFilesDiff }
        } catch (error) {
          return { error }
        }
      })
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
    try {
      return await this.mutex.runExclusive(async () => {
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
      })
    } catch (error) {
      return { result: null, error }
    }
  }
}

module.exports = { NetlifyFunction }
