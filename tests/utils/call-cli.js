const execa = require('execa')

const cliPath = require('./cli-path')

const CLI_TIMEOUT = 3e5

const callCli = async function (args, execOptions) {
  const { stdout } = await execa(cliPath, args, {
    timeout: CLI_TIMEOUT,
    ...execOptions,
  })
  return stdout
}

module.exports = callCli
