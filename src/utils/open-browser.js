const process = require('process')

const chalk = require('chalk')
const isDockerContainer = require('is-docker')
const open = require('open')

const unableToOpenBrowserMessage = function ({ url, log, message }) {
  log('---------------------------')
  log(chalk.redBright(`Error: Unable to open browser automatically: ${message}`))
  log(chalk.cyan('Please open your browser and open the URL below:'))
  log(chalk.bold(url))
  log('---------------------------')
}

const openBrowser = async function ({ url, log, silentBrowserNoneError }) {
  if (isDockerContainer()) {
    unableToOpenBrowserMessage({ url, log, message: 'Running inside a docker container' })
    return
  }
  if (process.env.BROWSER === 'none') {
    if (!silentBrowserNoneError) {
      unableToOpenBrowserMessage({ url, log, message: "BROWSER environment variable is set to 'none'" })
    }
    return
  }

  try {
    await open(url)
  } catch (error) {
    unableToOpenBrowserMessage({ url, log, message: error.message })
  }
}

module.exports = openBrowser
