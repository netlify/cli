const execa = require('execa')

const cliPath = require('./cli-path')

const CLI_TIMEOUT = 3e5

const callCli = async function (args, execOptions, parseJson = false) {
  const { stdout } = await execa(cliPath, args, {
    timeout: CLI_TIMEOUT,
    ...execOptions,
  })
  if (parseJson) {
    return JSON.parse(stdout)
  }
  return stdout
}

module.exports = callCli
