const chalk = require('chalk')

module.exports = function shortDescription(description) {
  // If building docs don't use chalk
  if (process.env.DOCS_GEN) {
    return description
  }
  return chalk.cyan(description)
}
