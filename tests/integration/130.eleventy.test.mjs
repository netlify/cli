import path from 'path'
import { fileURLToPath } from 'url'

import { afterAll, beforeAll, describe, test } from 'vitest'

// TODO: Why use this if when dev uses node 16 or 18 'client-ip' behaves exactly the same?
// import { clientIP, originalIP } from '../lib/local-ip.cjs'

import { startDevServer } from './utils/dev-server.cjs'
import got from './utils/got.cjs'

const [clientIP, originalIP] = ['127.0.0.1', '::ffff:127.0.0.1']

// eslint-disable-next-line no-underscore-dangle
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const context = {}

describe.concurrent('eleventy', () => {
  beforeAll(async () => {
    const server = await startDevServer({ cwd: path.join(__dirname, '__fixtures__/eleventy-site') })

    context.server = server
  })

  afterAll(async () => {
    const { server } = context
    await server.close()
  })

  test('homepage', async (t) => {
    const { url } = context.server
    const response = await got(`${url}/`).text()

    t.expect(response.includes('Eleventy Site')).toBe(true)
  })

  test('redirect test', async (t) => {
    const { url } = context.server
    const { body, headers, statusCode } = await got(`${url}/something`, { followRedirect: false })

    t.expect(statusCode).toBe(301)
    t.expect(headers.location).toEqual(`/otherthing`)
    t.expect(body).toEqual('Redirecting to /otherthing')
  })

  // TODO: un-skip this once https://github.com/netlify/cli/issues/1242 is fixed
  test.skip('normal rewrite', async (t) => {
    const { url } = context.server
    const { body, headers, statusCode } = await got(`${url}/doesnt-exist`)

    t.expect(statusCode).toBe(200)
    t.expect(headers['content-type'].startsWith('text/html')).toBe(true)
    t.expect(body.includes('Eleventy Site')).toBe(true)
  })

  test('force rewrite', async (t) => {
    const { url } = context.server
    const { body, headers, statusCode } = await got(`${url}/force`)

    t.expect(statusCode).toBe(200)
    t.expect(headers['content-type'].startsWith('text/html')).toBe(true)
    t.expect(body.includes('<h1>Test content</h1>')).toBe(true)
  })

  test('functions rewrite echo without body', async (t) => {
    const { host, port, url } = context.server
    const response = await got(`${url}/api/echo?ding=dong`).json()
    const { 'x-nf-request-id': requestID, ...headers } = response.headers

    t.expect(response.body).toBeUndefined()
    t.expect(headers).toStrictEqual({
      accept: 'application/json',
      'accept-encoding': 'gzip, deflate, br',
      'client-ip': clientIP,
      connection: 'close',
      host: `${host}:${port}`,
      'user-agent': 'got (https://github.com/sindresorhus/got)',
      'x-forwarded-for': originalIP,
      'x-nf-client-connection-ip': clientIP,
      'x-nf-geo':
        '{"city":"San Francisco","country":{"code":"US","name":"United States"},"subdivision":{"code":"CA","name":"California"},"longitude":0,"latitude":0,"timezone":"UTC"}',
    })
    t.expect(requestID.length).toBe(26)
    t.expect(response.httpMethod).toEqual('GET')
    t.expect(response.isBase64Encoded).toBe(true)
    t.expect(response.path).toEqual('/api/echo')
    t.expect(response.queryStringParameters).toStrictEqual({ ding: 'dong' })
  })

  test('functions rewrite echo with body', async (t) => {
    const { host, port, url } = context.server
    const response = await got
      .post(`${url}/api/echo?ding=dong`, {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: 'some=thing',
      })
      .json()
    const { 'x-nf-request-id': requestID, ...headers } = response.headers

    t.expect(response.body).toEqual('some=thing')
    t.expect(headers).toStrictEqual({
      accept: 'application/json',
      'accept-encoding': 'gzip, deflate, br',
      'client-ip': clientIP,
      connection: 'close',
      host: `${host}:${port}`,
      'content-type': 'application/x-www-form-urlencoded',
      'content-length': '10',
      'user-agent': 'got (https://github.com/sindresorhus/got)',
      'x-forwarded-for': originalIP,
      'x-nf-client-connection-ip': clientIP,
      'x-nf-geo':
        '{"city":"San Francisco","country":{"code":"US","name":"United States"},"subdivision":{"code":"CA","name":"California"},"longitude":0,"latitude":0,"timezone":"UTC"}',
    })
    t.expect(requestID.length).toBe(26)
    t.expect(response.httpMethod).toEqual('POST')
    t.expect(response.isBase64Encoded).toBe(false)
    t.expect(response.path).toEqual('/api/echo')
    t.expect(response.queryStringParameters).toStrictEqual({ ding: 'dong' })
  })

  test('functions echo with multiple query params', async (t) => {
    const { host, port, url } = context.server
    const response = await got(`${url}/.netlify/functions/echo?category=a&category=b`).json()
    const { 'x-nf-request-id': requestID, ...headers } = response.headers

    t.expect(headers).toStrictEqual({
      accept: 'application/json',
      'accept-encoding': 'gzip, deflate, br',
      'client-ip': clientIP,
      connection: 'close',
      host: `${host}:${port}`,
      'user-agent': 'got (https://github.com/sindresorhus/got)',
      'x-forwarded-for': originalIP,
      'x-nf-client-connection-ip': clientIP,
      'x-nf-geo':
        '{"city":"San Francisco","country":{"code":"US","name":"United States"},"subdivision":{"code":"CA","name":"California"},"longitude":0,"latitude":0,"timezone":"UTC"}',
    })
    t.expect(requestID.length).toBe(26)
    t.expect(response.httpMethod).toEqual('GET')
    t.expect(response.isBase64Encoded).toBe(true)
    t.expect(response.path).toEqual('/.netlify/functions/echo')
    t.expect(response.queryStringParameters).toStrictEqual({ category: 'a, b' })
    t.expect(response.multiValueQueryStringParameters).toStrictEqual({ category: ['a', 'b'] })
  })
})
