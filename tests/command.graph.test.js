import test from 'ava'

import callCli from './utils/call-cli.js'
import { normalize } from './utils/snapshots.js'

test('netlify graph', async (t) => {
  const cliResponse = await callCli(['graph'])
  t.snapshot(normalize(cliResponse))
})

test('netlify graph completion', async (t) => {
  const cliResponse = await callCli(['graph', 'pull'])
  t.snapshot(normalize(cliResponse))
})
