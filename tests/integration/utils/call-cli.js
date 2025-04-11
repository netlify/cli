import execa from 'execa'

import { cliPath } from './cli-path.js'

const CLI_TIMEOUT = 3e5

/**
 * Calls the Cli with a max timeout.
 * If the `parseJson` argument is specified then the result will be converted into an object.
 * @param {readonly string[]} args
 * @param {execa.Options<string>} execOptions
 * @param {boolean} parseJson
 * @returns {Promise<string>}
 */
export const callCli = async function (args, execOptions = {}, parseJson = false) {
  const { env = {}, ...execOptionsWithoutEnv } = execOptions
  const { stdout } = await execa.node(cliPath, args, {
    timeout: CLI_TIMEOUT,
    nodeOptions: [],
    env: {
      ...env,
      // TODO(serhalp) Why not exercise colorization in integration tests? Remove and update snapshots?
      NO_COLOR: '1',
    },
    ...execOptionsWithoutEnv,
  })
  if (parseJson) {
    return JSON.parse(stdout)
  }
  return stdout
}
