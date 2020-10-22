const logSymbols = require('log-symbols')
const ora = require('ora')

const startSpinner = ({ text }) => {
  return ora({
    text,
  }).start()
}

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

module.exports = { startSpinner, stopSpinner }
