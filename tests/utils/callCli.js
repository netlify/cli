const execa = require('execa')
const cliPath = require('./cliPath')

async function callCli(args, execOptions) {
  const { stdout } = await execa(cliPath, args, { windowsHide: true, windowsVerbatimArguments: true, ...execOptions })
  return stdout
}

module.exports = callCli
