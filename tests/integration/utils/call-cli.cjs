// @ts-check
const execa = require('execa')

const cliPath = require('./cli-path.cjs')

const CLI_TIMEOUT = 3e5

/**
 * Calls the Cli with a max timeout.
 * If the `parseJson` argument is specified then the result will be converted into an object.
 * @param {readonly string[]} args
 * @param {execa.Options<string>} execOptions
 * @param {boolean} parseJson
 * @returns {Promise<string|object>}
 */
const callCli = async function (args, execOptions = {}, parseJson = false) {
  const { stdout } = await execa.node(cliPath, args, {
    timeout: CLI_TIMEOUT,
    ...execOptions,
  })
  if (parseJson) {
    return JSON.parse(stdout)
  }
  return stdout
}

module.exports = callCli
