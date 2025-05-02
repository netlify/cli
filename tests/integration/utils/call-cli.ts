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
  const { stdout, stderr } = await execa.node(cliPath, args, {
    timeout: CLI_TIMEOUT,
    nodeOptions: [],
    ...execOptions,
  })
  if (process.env.DEBUG_TESTS) {
    process.stdout.write(stdout)
    process.stderr.write(stderr)
  }

  if (parseJson) {
    return JSON.parse(stdout)
  }
  return stdout
}
