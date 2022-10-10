const path = require('path')
const process = require('process')

const test = require('ava')
const semver = require('semver')

const { startDevServer } = require('./utils/dev-server.cjs')
const got = require('./utils/got.cjs')

const version = process.version.slice(1)

// This test is currently failing on Node 17 and above due to
// https://github.com/netlify/cli/issues/3617.
if (semver.lt(version, '17.0.0')) {
  test.before(async (t) => {
    const server = await startDevServer({
      cwd: path.join(__dirname, 'hugo-site'),
      // required so configuration won't be resolved from the current CLI repo linked site
      args: ['--offline'],
      env: {
        HUGO_CACHEDIR: '/tmp',
      },
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
}

// This feels awkward, but ava will throw if we have a file with no tests, so
// we need something to run in case the test above is skipped.
test('dummy test', (t) => {
  t.true(true)
})
