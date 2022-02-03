const test = require('ava')

const callCli = require('./utils/call-cli')
const { normalize } = require('./utils/snapshots')

test('netlify help', async (t) => {
  const cliResponse = await callCli(['help'])
  t.snapshot(normalize(cliResponse))
})

test('netlify help completion', async (t) => {
  const cliResponse = await callCli(['help', 'completion'])
  t.snapshot(normalize(cliResponse))
})
