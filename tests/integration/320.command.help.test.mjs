import { test } from 'vitest'

import callCli from './utils/call-cli.cjs'
import { normalize } from './utils/snapshots.cjs'

test('netlify help', async (t) => {
  const cliResponse = await callCli(['help'])
  t.expect(normalize(cliResponse)).toMatchSnapshot()
})

test('netlify help completion', async (t) => {
  const cliResponse = await callCli(['help', 'completion'])
  t.expect(normalize(cliResponse)).toMatchSnapshot()
})
