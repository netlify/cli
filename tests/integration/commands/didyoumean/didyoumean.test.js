import { test } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { normalize } from '../../utils/snapshots.js'

test('suggests closest matching command on typo', async (t) => {
  // failures are expected since we effectively quit out of the prompts
  const errors = await Promise.allSettled([callCli(['sta']), callCli(['opeen']), callCli(['hel']), callCli(['versio'])])
  errors.forEach((error) => {
    t.expect(error.status).toEqual('rejected')
    t.expect(normalize(error.reason.stdout, { duration: true, filePath: true })).toMatchSnapshot()
  })
})
