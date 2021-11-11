const { join } = require('path')

const zisi = require('@netlify/zip-it-and-ship-it')
const test = require('ava')
const express = require('express')
const mockRequire = require('mock-require')
const sinon = require('sinon')
const request = require('supertest')

const { FunctionsRegistry } = require('./registry')
const { createHandler } = require('./server')

const projectRoot = `/my-functions`
const functionsPath = `functions`

/** @type { express.Express} */
let app

test.before(async (t) => {
  const mainFile = join(projectRoot, functionsPath, 'hello.js')
  t.context.zisiStub = sinon.stub(zisi, 'listFunctions').returns(
    Promise.resolve([
      {
        name: 'hello',
        mainFile,
        runtime: 'js',
        extension: '.js',
      },
    ]),
  )

  mockRequire(mainFile, {
    handler: (event) => ({ statusCode: 200, body: event.rawUrl }),
  })
  const functionsRegistry = new FunctionsRegistry({
    projectRoot,
    config: {},
    timeouts: { syncFunctions: 1, backgroundFunctions: 1 },
  })
  await functionsRegistry.scan([functionsPath])
  app = express()
  app.all('*', createHandler({ functionsRegistry }))
})

test.after((t) => {
  t.context.zisiStub.restore()
})

test('should get the url as the `rawUrl` inside the function', async (t) => {
  await request(app)
    .get('/hello')
    // .set('x-netlify-original-pathname', 'orig')
    .expect((res) => {
      t.is(res.status, 200)
      t.regex(res.text, /^http:\/\/127.0.0.1:\d+?\/hello/)
    })
})

test('should get the original url as the `rawUrl` when the header was provided by the proxy', async (t) => {
  await request(app)
    .get('/hello')
    .set('x-netlify-original-pathname', '/orig')
    .expect((res) => {
      t.is(res.status, 200)
      console.log(res.text)
      t.regex(res.text, /^http:\/\/127.0.0.1:\d+?\/orig/)
    })
})
