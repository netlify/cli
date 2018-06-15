const chalk = require('chalk')

module.exports = function shortDescription(description) {
  return chalk.cyan(description)
}
