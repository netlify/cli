const path = require('path')

const { startDevServer } = require('./utils/dev-server')
const got = require('./utils/got')

let server

beforeAll(async () => {
  server = await startDevServer({
    cwd: path.join(__dirname, 'hugo-site'),
    // required so configuration won't be resolved from the current CLI repo linked site
    args: ['--offline'],
  })
})

afterAll(async () => {
  await server.close()
})

test('should not infinite redirect when -d flag is passed', async () => {
  const { url } = server
  const response = await got(`${url}/`).text()

  expect(response.includes('Home page!')).toBe(true)
})
