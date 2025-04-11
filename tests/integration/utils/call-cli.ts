// @ts-expect-error TS(1259) FIXME: Module '"/home/ndhoule/dev/src/github.com/netlify/... Remove this comment to see the full error message
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
  const { stdout } = await execa.node(cliPath, args, {
    timeout: CLI_TIMEOUT,
    nodeOptions: [],
    ...execOptions,
  })
  if (parseJson) {
    return JSON.parse(stdout)
  }
  return stdout
}
