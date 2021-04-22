const path = require('path')

const test = require('ava')

const { startDevServer } = require('./utils/dev-server')
const got = require('./utils/got')

test.before(async (t) => {
  const server = await startDevServer({
    cwd: path.join(__dirname, 'hugo-site'),
    // required so configuration won't be resolved from the current CLI repo linked site
    args: ['--offline'],
  })

  t.context.server = server
})

test.after(async (t) => {
  const { server } = t.context
  await server.close()
})

test('should not infinite redirect when -d flag is passed', async (t) => {
  const { url } = t.context.server
  const response = await got(`${url}/`).text()

  t.true(response.includes('Home page!'))
})
