const { getLogMessage } = require('../log')

const { NetlifyFunction } = require('./netlify-function')
const runtimes = require('./runtimes')

class FunctionsRegistry {
  constructor({ capabilities, timeouts, warn }) {
    this.capabilities = capabilities
    this.timeouts = timeouts
    this.warn = warn

    this.functions = new Map()

    // Performance optimization: load '@netlify/zip-it-and-ship-it' on demand.
    // eslint-disable-next-line node/global-require
    const { listFunctions } = require('@netlify/zip-it-and-ship-it')

    this.listFunctions = listFunctions
  }

  get(name) {
    return this.functions.get(name)
  }

  registerFunction(name, func) {
    if (func.isBackground && !this.capabilities.backgroundFunctions) {
      this.warn(getLogMessage('functions.backgroundNotSupported'))
    }

    this.functions.set(name, func)
  }

  async scan(directory) {
    const functions = await this.listFunctions(directory)

    functions.forEach(({ mainFile, name, runtime: runtimeName }) => {
      const runtime = runtimes[runtimeName]

      if (runtime === undefined) {
        // This function's runtime is not supported by Netlify Dev.
        return
      }

      if (this.functions.has(name)) {
        return
      }

      const func = new NetlifyFunction({
        mainFile,
        name,
        runtime,
        timeoutBackground: this.timeouts.backgroundFunctions,
        timeoutSynchronous: this.timeouts.syncFunctions,
      })

      this.registerFunction(name, func)
    })
  }
}

module.exports = { FunctionsRegistry }
