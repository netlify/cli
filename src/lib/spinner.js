// @ts-check
const logSymbols = require('log-symbols')
const ora = require('ora')

/**
 * Creates a spinner with the following text
 * @param {object} config
 * @param {string} config.text
 * @returns {ora.Ora}
 */
const startSpinner = ({ text }) =>
  ora({
    text,
  }).start()

/**
 * Stops the spinner with the following text
 * @param {object} config
 * @param {ora.Ora} config.spinner
 * @param {object} [config.error]
 * @param {string} [config.text]
 * @returns {void}
 */
const stopSpinner = ({ error, spinner, text }) => {
  if (!spinner) {
    return
  }
  // TODO: refactor no package needed `log-symbols` for that
  const symbol = error ? logSymbols.error : logSymbols.success
  spinner.stopAndPersist({
    text,
    symbol,
  })
}

/**
 * Clears the spinner
 * @param {object} config
 * @param {ora.Ora} config.spinner
 * @returns {void}
 */
const clearSpinner = ({ spinner }) => {
  if (spinner) {
    spinner.stop()
  }
}

module.exports = { clearSpinner, startSpinner, stopSpinner }
