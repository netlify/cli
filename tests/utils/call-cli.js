'use strict'

const execa = require('execa')

const cliPath = require('./cli-path')

const callCli = async function (args, execOptions) {
  const { stdout } = await execa(cliPath, args, { windowsHide: true, windowsVerbatimArguments: true, ...execOptions })
  return stdout
}

module.exports = callCli
