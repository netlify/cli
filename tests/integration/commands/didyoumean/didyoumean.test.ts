import { test } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { normalize } from '../../utils/snapshots.js'

test('suggests closest matching command on typo', async (t) => {
  // failures are expected since we effectively quit out of the prompts
  const errors = await Promise.allSettled([
    callCli(['sta']) as Promise<string>,
    callCli(['opeen']) as Promise<string>,
    callCli(['hel']) as Promise<string>,
    callCli(['versio']) as Promise<string>,
  ])

  for (const error of errors) {
    t.expect(error.status).toEqual('rejected')
    t.expect(error).toHaveProperty('reason.stdout', t.expect.any(String))
    t.expect(
      normalize((error as { reason: { stdout: string } }).reason.stdout, { duration: true, filePath: true }),
    ).toMatchSnapshot()
  }
})
