const callCli = require('./utils/call-cli')
const { normalize } = require('./utils/snapshots')

test('netlify help', async () => {
  const cliResponse = await callCli(['help'])
  expect(normalize(cliResponse)).toMatchSnapshot()
})

test('netlify help completion', async () => {
  const cliResponse = await callCli(['help', 'completion'])
  expect(normalize(cliResponse)).toMatchSnapshot()
})
