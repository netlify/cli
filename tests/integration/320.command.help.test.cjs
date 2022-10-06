const test = require('ava')

const callCli = require('./utils/call-cli.cjs')
const { normalize } = require('./utils/snapshots.cjs')

test('netlify help', async (t) => {
  const cliResponse = await callCli(['help'])
  t.snapshot(normalize(cliResponse))
})

test('netlify help completion', async (t) => {
  const cliResponse = await callCli(['help', 'completion'])
  t.snapshot(normalize(cliResponse))
})
