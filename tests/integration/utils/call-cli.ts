import execa from 'execa'

import { cliPath } from './cli-path.js'

const CLI_TIMEOUT = 3e5

/**
 * Calls the Cli with a max timeout.
 *
 * If the `parseJson` argument is specified then the result will be converted into an object.
 */
// FIXME(ndhoule): Discriminate on return type depending on `parseJson` option; it should be a
// `Promise<string>` when false and a `Promise<unknown>` when true.
export const callCli = async function (
  args: string[] = [],
  execOptions: execa.NodeOptions = {},
  parseJson = false,
): // eslint-disable-next-line @typescript-eslint/no-explicit-any
Promise<any> {
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
