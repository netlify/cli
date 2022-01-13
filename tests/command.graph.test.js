const test = require('ava')

const callCli = require('./utils/call-cli')
const { normalize } = require('./utils/snapshots')

test('netlify graph', async (t) => {
    const cliResponse = await callCli(['graph'])
    t.snapshot(normalize(cliResponse))
})

test('netlify graph completion', async (t) => {
    const cliResponse = await callCli(['graph', 'pull'])
    t.snapshot(normalize(cliResponse))
})
