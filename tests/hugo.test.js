import path from 'path'

import test from 'ava'

import { startDevServer } from './utils/dev-server.js'
import got from './utils/got.js'

test.before(async (t) => {
  const server = await startDevServer({
    cwd: new URL('hugo-site', import.meta.url).pathname,
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
