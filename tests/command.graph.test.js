const callCli = require('./utils/call-cli')
const { normalize } = require('./utils/snapshots')

test('netlify graph', async () => {
  const cliResponse = await callCli(['graph'])
  expect(normalize(cliResponse)).toMatchSnapshot()
})

test('netlify graph completion', async () => {
  const cliResponse = await callCli(['graph', 'pull'])
  expect(normalize(cliResponse)).toMatchSnapshot()
})
