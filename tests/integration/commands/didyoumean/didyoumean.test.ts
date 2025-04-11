import { test } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { normalize } from '../../utils/snapshots.js'

test('suggests closest matching command on typo', async (t) => {
  // failures are expected since we effectively quit out of the prompts
  const errors = await Promise.allSettled([callCli(['sta']), callCli(['opeen']), callCli(['hel']), callCli(['versio'])])
  errors.forEach((error) => {
    t.expect(error.status).toEqual('rejected')
    // @ts-expect-error TS(2339) FIXME: Property 'reason' does not exist on type 'PromiseS... Remove this comment to see the full error message
    t.expect(normalize(error.reason.stdout, { duration: true, filePath: true })).toMatchSnapshot()
  })
})
