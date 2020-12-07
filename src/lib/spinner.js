const logSymbols = require('log-symbols')
const ora = require('ora')

const startSpinner = ({ text }) =>
  ora({
    text,
  }).start()

const stopSpinner = ({ spinner, text, error }) => {
  if (!spinner) {
    return
  }
  const symbol = error ? logSymbols.error : logSymbols.success
  spinner.stopAndPersist({
    text,
    symbol,
  })
}

const clearSpinner = ({ spinner }) => {
  if (spinner) {
    spinner.stop()
  }
}

module.exports = { clearSpinner, startSpinner, stopSpinner }
