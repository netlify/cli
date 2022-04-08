const { mkdirSync, mkdtempSync, writeFileSync } = require('fs')
const { tmpdir } = require('os')
const { join } = require('path')

const test = require('ava')
const express = require('express')
const request = require('supertest')

const { FunctionsRegistry } = require('../../../../src/lib/functions/registry')
const { createHandler } = require('../../../../src/lib/functions/server')

/** @type { express.Express} */
let app

test.before(async () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'functions-server-project-root'))
  const functionsDirectory = join(projectRoot, 'functions')
  mkdirSync(functionsDirectory)

  const mainFile = join(functionsDirectory, 'hello.js')
  writeFileSync(mainFile, `exports.handler = async (event) => ({ statusCode: 200, body: event.rawUrl })`)

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

test('should get the url as the `rawUrl` inside the function', async (t) => {
  await request(app)
    .get('/hello')
    .expect((res) => {
      t.is(res.status, 200)
      t.regex(res.text, /^http:\/\/127.0.0.1:\d+?\/hello$/)
    })
})

test('should get the original url as the `rawUrl` when the header was provided by the proxy', async (t) => {
  await request(app)
    .get('/hello')
    .set('x-netlify-original-pathname', '/orig')
    .expect((res) => {
      t.is(res.status, 200)
      console.log(res.text)
      t.regex(res.text, /^http:\/\/127.0.0.1:\d+?\/orig$/)
    })
})

test('should check if query params are passed to the `rawUrl` when redirected', async (t) => {
  await request(app)
    .get('/hello?jam=stack')
    .set('x-netlify-original-pathname', '/orig')
    .expect((res) => {
      t.is(res.status, 200)
      console.log(res.text)
      t.regex(res.text, /^http:\/\/127.0.0.1:\d+?\/orig\?jam=stack$/)
    })
})
