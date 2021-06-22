const BACKGROUND_SUFFIX = '-background'

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
  }

  async build() {
    const buildFunction = await this.runtime.getBuildFunction({
      config: this.config,
      errorExit: this.errorExit,
      func: this,
      functionsDirectory: this.functionsDirectory,
      projectRoot: this.projectRoot,
    })

    this.buildQueue = typeof buildFunction === 'function' ? buildFunction(this) : undefined

    try {
      const { srcFiles, ...buildData } = (await this.buildQueue) || {}
      const srcFilesSet = new Set(srcFiles)
      const srcFilesDiff = this.getSrcFilesDiff(srcFilesSet)

      this.buildData = buildData
      this.srcFiles = srcFilesSet

      return { srcFilesDiff }
    } catch (error) {
      return { error }
    }
  }

  getSrcFilesDiff(srcFiles) {
    const added = new Set()
    const deleted = new Set()

    srcFiles.forEach((path) => {
      if (!this.srcFiles.has(path)) {
        added.add(path)
      }
    })

    this.srcFiles.forEach((path) => {
      if (!srcFiles.has(path)) {
        deleted.add(path)
      }
    })

    return {
      added,
      deleted,
    }
  }

  async invoke(event, context) {
    await this.buildQueue

    const timeout = this.isBackground ? this.timeoutBackground : this.timeoutSynchronous

    let error = null
    let result = null

    try {
      result = await this.runtime.invokeFunction({
        context,
        event,
        func: this,
        timeout,
      })
    } catch (functionError) {
      error = functionError
    }

    return { error, result }
  }
}

module.exports = { NetlifyFunction }
