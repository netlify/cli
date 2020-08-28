const execa = require('execa')
const cliPath = require('./cliPath')

async function callCli(args, execOptions) {
  return (await execa(cliPath, args, execOptions)).stdout
}

module.exports = callCli
