import test from 'ava'

import callCli from './utils/call-cli.cjs'
import { normalize } from './utils/snapshots.cjs'

test('netlify help', async (t) => {
  const cliResponse = await callCli(['help'])
  t.snapshot(normalize(cliResponse))
})

test('netlify help completion', async (t) => {
  const cliResponse = await callCli(['help', 'completion'])
  t.snapshot(normalize(cliResponse))
})
