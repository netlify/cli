
import process from 'process'

// @ts-ignore
import open from 'better-opn'
import isDockerContainer from 'is-docker'


const { chalk, log } = require('./command-helpers.mjs')

const unableToOpenBrowserMessage = function ({
  message,
  url

}: $TSFixMe) {
  log('---------------------------')
  log(chalk.redBright(`Error: Unable to open browser automatically: ${message}`))
  log(chalk.cyan('Please open your browser and open the URL below:'))
  log(chalk.bold(url))
  log('---------------------------')
}

/**
 * Opens a browser and logs a message if it is not possible
 * @param {object} config
 * @param {string} config.url The url to open
 * @param {boolean} [config.silentBrowserNoneError]
 * @returns {Promise<void>}
 */

const openBrowser = async function ({
  silentBrowserNoneError,
  url

}: $TSFixMe) {
  if (isDockerContainer()) {
    unableToOpenBrowserMessage({ url, message: 'Running inside a docker container' })
    return
  }
  if (process.env.BROWSER === 'none') {
    if (!silentBrowserNoneError) {
      unableToOpenBrowserMessage({ url, message: "BROWSER environment variable is set to 'none'" })
    }
    return
  }

  try {
    await open(url)
  } catch (error) {
    
    unableToOpenBrowserMessage({ url, message: (error as $TSFixMe).message });
  }
}

export default { openBrowser }
