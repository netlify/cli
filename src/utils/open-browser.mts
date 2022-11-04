// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'process'.
const process = require('process')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'open'.
const open = require('better-opn')
const isDockerContainer = require('is-docker')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'chalk'.
const { chalk, log } = require('./command-helpers.cjs')

const unableToOpenBrowserMessage = function ({
  message,
  url
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
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
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'openBrowse... Remove this comment to see the full error message
const openBrowser = async function ({
  silentBrowserNoneError,
  url
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
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
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    unableToOpenBrowserMessage({ url, message: (error as $TSFixMe).message });
  }
}

module.exports = { openBrowser }
