const os = require('os')

const boxen = require('boxen')
const chalk = require('chalk')

const { shellVariables, isBinInPath } = require('./install')

const printBanner = function (command, force) {
  const print = force || !isBinInPath()
  const platform = os.platform()

  if (print && platform !== 'win32') {
    const shellInfo = shellVariables()
    const banner = chalk.bold(
      `Run this command to use Netlify Large Media in your current shell\n\nsource ${shellInfo.path}`,
    )

    command.log(boxen(banner, { padding: 1, margin: 1, align: 'center', borderColor: '#00c7b7' }))
  }
}

module.exports = { printBanner }
