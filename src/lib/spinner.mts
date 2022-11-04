// @ts-check
const logSymbols = require('log-symbols')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'ora'.
const ora = require('ora')

/**
 * Creates a spinner with the following text
 * @param {object} config
 * @param {string} config.text
 * @returns {ora.Ora}
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'startSpinn... Remove this comment to see the full error message
const startSpinner = ({
  text
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) =>
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
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'stopSpinne... Remove this comment to see the full error message
const stopSpinner = ({
  error,
  spinner,
  text
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
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
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'clearSpinn... Remove this comment to see the full error message
const clearSpinner = ({
  spinner
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  if (spinner) {
    spinner.stop()
  }
}

module.exports = { clearSpinner, startSpinner, stopSpinner }
