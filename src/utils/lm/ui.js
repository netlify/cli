const os = require('os')
const path = require('path')
const process = require('process')

const boxen = require('boxen')
const chalk = require('chalk')

const { shellVariables, joinBinPath } = require('./install')

const printBanner = function (command, force) {
  const print = force || !binInPath()
  const platform = os.platform()

  if (print && platform !== 'win32') {
    const shellInfo = shellVariables()
    const banner = chalk.bold(
      `Run this command to use Netlify Large Media in your current shell\n\nsource ${shellInfo.path}`,
    )

    command.log(boxen(banner, { padding: 1, margin: 1, align: 'center', borderColor: '#00c7b7' }))
  }
}

const binInPath = function () {
  const envPath = process.env.PATH || ''
  const binPath = joinBinPath()
  return envPath
    .replace(/"+/g, '')
    .split(path.delimiter)
    .find((part) => part === binPath)
}

module.exports = { printBanner }
