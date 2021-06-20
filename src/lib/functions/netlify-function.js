const BACKGROUND_SUFFIX = '-background'

class NetlifyFunction {
  constructor({ mainFile, name, runtime, timeoutBackground, timeoutSynchronous }) {
    this.mainFile = mainFile
    this.name = name
    this.runtime = runtime
    this.timeoutBackground = timeoutBackground
    this.timeoutSynchronous = timeoutSynchronous

    this.isBackground = name.endsWith(BACKGROUND_SUFFIX)
    this.urlPath = `/.netlify/functions/${name}`
  }

  async invoke(event, context) {
    const timeout = this.isBackground ? this.timeoutBackground : this.timeoutSynchronous

    let error = null
    let result = null

    try {
      result = await this.runtime.invokeFunction({
        context,
        event,
        mainFile: this.mainFile,
        timeout,
      })
    } catch (functionError) {
      error = functionError
    }

    return { error, result }
  }
}

module.exports = { NetlifyFunction }
