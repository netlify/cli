const { mkdirSync, mkdtempSync, writeFileSync } = require('fs')
const { tmpdir } = require('os')
const { join } = require('path')

const express = require('express')
const request = require('supertest')

const { rmdirRecursiveAsync } = require('../fs')

const { FunctionsRegistry } = require('./registry')
const { createHandler } = require('./server')

// the fixture has no pkg json so mock it away
jest.mock('read-pkg-up')

/** @type { express.Express} */
let app

const projectRoot = mkdtempSync(join(tmpdir(), 'functions-server-project-root'))

beforeAll(async () => {
  const functionsDirectory = join(projectRoot, 'functions')
  mkdirSync(functionsDirectory)

  const mainFile = join(functionsDirectory, 'hello.js')
  writeFileSync(mainFile, `exports.handler = (event) => ({ statusCode: 200, body: event.rawUrl })`)

  const functionsRegistry = new FunctionsRegistry({
    projectRoot,
    config: {},
    timeouts: { syncFunctions: 1, backgroundFunctions: 1 },
    // eslint-disable-next-line no-magic-numbers
    settings: { port: 8888 },
  })
  await functionsRegistry.scan([functionsDirectory])
  app = express()
  app.all('*', createHandler({ functionsRegistry }))
})

afterAll(async () => {
  await rmdirRecursiveAsync(projectRoot)
})

test('should get the url as the `rawUrl` inside the function', async () => {
  await request(app)
    .get('/hello')
    .expect((res) => {
      expect(res.status).toBe(200)
      expect(res.text).toMatch(/^http:\/\/127.0.0.1:\d+?\/hello$/)
    })
})

test('should get the original url as the `rawUrl` when the header was provided by the proxy', async () => {
  await request(app)
    .get('/hello')
    .set('x-netlify-original-pathname', '/orig')
    .expect((res) => {
      expect(res.status).toBe(200)
      console.log(res.text)
      expect(res.text).toMatch(/^http:\/\/127.0.0.1:\d+?\/orig$/)
    })
})

test('should check if query params are passed to the `rawUrl` when redirected', async () => {
  await request(app)
    .get('/hello?jam=stack')
    .set('x-netlify-original-pathname', '/orig')
    .expect((res) => {
      expect(res.status).toBe(200)
      console.log(res.text)
      expect(res.text).toMatch(/^http:\/\/127.0.0.1:\d+?\/orig\?jam=stack$/)
    })
})
