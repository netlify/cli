import { Buffer } from 'buffer'
import path from 'path'
import { fileURLToPath } from 'url'

import fetch from 'node-fetch'
import { afterAll, beforeAll, describe, test } from 'vitest'

import { clientIP, originalIP } from '../../lib/local-ip.js'
import { startDevServer } from '../utils/dev-server.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const context = {}

beforeAll(async () => {
  const server = await startDevServer({
    cwd: path.join(__dirname, '../__fixtures__/eleventy-site'),
    // the tests are made for static serving it but our detection is to good and detects 11ty
    args: ['--framework', '#static'],
  })

  context.server = server
})

afterAll(async () => {
  const { server } = context
  await server.close()
})

describe.skip('eleventy', () => {
  test('homepage', async (t) => {
    const { url } = context.server
    const response = await fetch(`${url}/`).then((res) => res.text())

    t.expect(response.includes('Eleventy Site')).toBe(true)
  })

  test('redirect test', async (t) => {
    const { url } = context.server
    const response = await fetch(`${url}/something`, {
      redirect: 'manual',
    })
    const { headers, status } = response

    t.expect(status).toBe(301)
    t.expect(headers.get('location').endsWith('/otherthing')).toBe(true)
    t.expect(await response.text()).toEqual('Redirecting to /otherthing')
  })

  test('normal rewrite', async (t) => {
    const { url } = context.server
    const response = await fetch(`${url}/doesnt-exist`)
    const { headers, status } = response
    const body = await response.text()

    t.expect(status).toBe(200)
    t.expect(headers.get('content-type').startsWith('text/html')).toBe(true)
    t.expect(body.includes('Eleventy Site')).toBe(true)
  })

  test('force rewrite', async (t) => {
    const { url } = context.server
    const response = await fetch(`${url}/force`)
    const { headers, status } = response
    const body = await response.text()

    t.expect(status).toBe(200)
    t.expect(headers.get('content-type').startsWith('text/html')).toBe(true)
    t.expect(body.includes('<h1>Test content</h1>')).toBe(true)
  })

  test('functions rewrite echo without body', async (t) => {
    const { host, port, url } = context.server
    const jsonResponse = await fetch(`${url}/api/echo?ding=dong`, {
      headers: { accept: 'application/json', 'accept-encoding': 'gzip, deflate, br' },
    }).then((res) => res.json())
    const { 'x-nf-request-id': requestID, ...headers } = jsonResponse.headers

    t.expect(jsonResponse.body).toBe(undefined)
    t.expect(headers).toStrictEqual({
      accept: 'application/json',
      'accept-encoding': 'gzip, deflate, br',
      'client-ip': clientIP,
      connection: 'close',
      host: `${host}:${port}`,
      'user-agent': 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
      'x-forwarded-for': originalIP,
      'x-nf-account-id': '',
      'x-nf-client-connection-ip': clientIP,
      'x-nf-geo': Buffer.from(
        '{"city":"San Francisco","country":{"code":"US","name":"United States"},"subdivision":{"code":"CA","name":"California"},"longitude":0,"latitude":0,"timezone":"UTC"}',
      ).toString('base64'),
    })
    t.expect(requestID.length).toBe(26)
    t.expect(jsonResponse.httpMethod).toEqual('GET')
    t.expect(jsonResponse.isBase64Encoded).toBe(true)
    t.expect(jsonResponse.path).toEqual('/api/echo')
    t.expect(jsonResponse.queryStringParameters).toStrictEqual({ ding: 'dong' })
  })

  test('functions rewrite echo with body', async (t) => {
    const { host, port, url } = context.server
    const response = await fetch(`${url}/api/echo?ding=dong`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'accept-encoding': 'gzip, deflate, br',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'some=thing',
    }).then((res) => res.json())
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
      'user-agent': 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
      'x-forwarded-for': originalIP,
      'x-nf-account-id': '',
      'x-nf-client-connection-ip': clientIP,
      'x-nf-geo': Buffer.from(
        '{"city":"San Francisco","country":{"code":"US","name":"United States"},"subdivision":{"code":"CA","name":"California"},"longitude":0,"latitude":0,"timezone":"UTC"}',
      ).toString('base64'),
    })
    t.expect(requestID.length).toBe(26)
    t.expect(response.httpMethod).toEqual('POST')
    t.expect(response.isBase64Encoded).toBe(false)
    t.expect(response.path).toEqual('/api/echo')
    t.expect(response.queryStringParameters).toStrictEqual({ ding: 'dong' })
  })

  test('functions echo with multiple query params', async (t) => {
    const { host, port, url } = context.server
    const response = await fetch(`${url}/.netlify/functions/echo?category=a&category=b`, {
      headers: {
        accept: 'application/json',
        'accept-encoding': 'gzip, deflate, br',
      },
    }).then((res) => res.json())
    const { 'x-nf-request-id': requestID, ...headers } = response.headers

    t.expect(headers).toStrictEqual({
      accept: 'application/json',
      'accept-encoding': 'gzip, deflate, br',
      'client-ip': clientIP,
      connection: 'close',
      host: `${host}:${port}`,
      'user-agent': 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
      'x-forwarded-for': originalIP,
      'x-nf-account-id': '',
      'x-nf-client-connection-ip': clientIP,
      'x-nf-geo': Buffer.from(
        '{"city":"San Francisco","country":{"code":"US","name":"United States"},"subdivision":{"code":"CA","name":"California"},"longitude":0,"latitude":0,"timezone":"UTC"}',
      ).toString('base64'),
    })
    t.expect(requestID.length).toBe(26)
    t.expect(response.httpMethod).toEqual('GET')
    t.expect(response.isBase64Encoded).toBe(true)
    t.expect(response.path).toEqual('/.netlify/functions/echo')
    t.expect(response.queryStringParameters).toStrictEqual({ category: 'a, b' })
    t.expect(response.multiValueQueryStringParameters).toStrictEqual({ category: ['a', 'b'] })
  })
})
