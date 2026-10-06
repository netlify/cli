import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { lookup } from 'dns/promises'
import net from 'net'
import { tmpdir } from 'os'
import { join } from 'path'

import getPort from 'get-port'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

import { startStaticServer } from '../../../src/utils/static-server.js'

vi.mock('../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../src/utils/command-helpers.js')),
  log: vi.fn(),
}))

const FILE_CACHE_CONTROL = 'public, max-age=0'
const GENERATED_RESPONSE_CACHE_CONTROL = 'public, max-age=0, must-revalidate'
const HTML = 'text/html; charset=utf-8'
const PLAIN = 'text/plain; charset=utf-8'
const CUSTOM_404 = '<h1>custom 404</h1>'

const createSite = async ({ with404Page }: { with404Page: boolean }) => {
  const parent = await mkdtemp(join(tmpdir(), 'static-server-'))
  await writeFile(join(parent, 'outside.txt'), 'outside')
  await mkdir(join(parent, 'outside-dir'))
  const root = join(parent, 'site')
  await mkdir(root)
  await writeFile(join(root, 'index.html'), '<h1>home</h1>')
  await writeFile(join(root, 'style.css'), 'body{}')
  await writeFile(join(root, 'data.json'), '{"a":1}')
  await writeFile(join(root, 'noext'), 'plain')
  await writeFile(join(root, '.hidden'), 'dotfile')
  await writeFile(join(root, 'file with space.txt'), 'spaced')
  await mkdir(join(root, 'sub'))
  await writeFile(join(root, 'sub', 'index.html'), '<h1>sub</h1>')
  await mkdir(join(root, 'empty'))
  if (with404Page) {
    await writeFile(join(root, '404.html'), CUSTOM_404)
  }
  return { parent, root }
}

// fetch normalizes `..` segments away, so traversal attempts need a raw request.
const sendRawRequest = (port: number, rawPath: string) =>
  new Promise<{ status: number; body: string }>((resolve, reject) => {
    const socket = net.connect({ host: '127.0.0.1', port }, () => {
      socket.write(`GET ${rawPath} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n`)
    })
    let response = ''
    socket.on('data', (chunk) => {
      response += chunk.toString()
    })
    socket.on('end', () => {
      const [head, body = ''] = response.split('\r\n\r\n')
      resolve({ status: Number(head.split(' ')[1]), body })
    })
    socket.on('error', reject)
  })

const canConnect = (host: string, port: number) =>
  new Promise<boolean>((resolve) => {
    const socket = net.connect({ host, port }, () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('error', () => {
      resolve(false)
    })
  })

describe('startStaticServer', () => {
  const sites: string[] = []
  let baseUrl: string
  let port: number
  let family: string

  beforeAll(async () => {
    const { parent, root } = await createSite({ with404Page: true })
    sites.push(parent)
    port = await getPort()
    ;({ family } = await startStaticServer({ settings: { dist: root, frameworkPort: port } }))
    baseUrl = `http://127.0.0.1:${String(port)}`
  })

  afterAll(async () => {
    await Promise.all(sites.map((site) => rm(site, { recursive: true, force: true })))
  })

  test.each([
    { path: '/', contentType: HTML, body: '<h1>home</h1>' },
    { path: '/index.html', contentType: HTML, body: '<h1>home</h1>' },
    { path: '/style.css', contentType: 'text/css; charset=utf-8', body: 'body{}' },
    { path: '/data.json', contentType: 'application/json; charset=utf-8', body: '{"a":1}' },
    { path: '/noext', contentType: 'application/octet-stream', body: 'plain' },
    { path: '/.hidden', contentType: 'application/octet-stream', body: 'dotfile' },
    { path: '/file%20with%20space.txt', contentType: PLAIN, body: 'spaced' },
    { path: '/sub', contentType: HTML, body: '<h1>sub</h1>' },
    { path: '/sub/', contentType: HTML, body: '<h1>sub</h1>' },
    { path: '/style.css?v=2', contentType: 'text/css; charset=utf-8', body: 'body{}' },
  ])('serves $path with status 200 and no redirect', async ({ path, contentType, body }) => {
    const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual' })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe(contentType)
    expect(response.headers.get('cache-control')).toBe(FILE_CACHE_CONTROL)
    expect(response.headers.get('age')).toBe('0')
    expect(await response.text()).toBe(body)
  })

  test.each(['/missing', '/missing.css', '/empty', '/empty/', '/../etc/passwd', '/%2e%2e/%2e%2e/etc/passwd'])(
    'serves the custom 404 page for %s',
    async (path) => {
      const response = await fetch(`${baseUrl}${path}`)

      expect(response.status).toBe(404)
      expect(response.headers.get('content-type')).toBe(HTML)
      expect(response.headers.get('cache-control')).toBe(FILE_CACHE_CONTROL)
      expect(await response.text()).toBe(CUSTOM_404)
    },
  )

  test.each(['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'])('rejects %s with 405', async (method) => {
    const response = await fetch(`${baseUrl}/`, { method })

    expect(response.status).toBe(405)
    expect(response.headers.get('content-type')).toBe(PLAIN)
    expect(response.headers.get('cache-control')).toBe(GENERATED_RESPONSE_CACHE_CONTROL)
    expect(await response.text()).toBe('Method Not Allowed')
  })

  test('answers HEAD requests without a body', async () => {
    const response = await fetch(`${baseUrl}/`, { method: 'HEAD' })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-length')).toBe(String('<h1>home</h1>'.length))
    expect(await response.text()).toBe('')
  })

  test.each<{ name: string; headers: Record<string, string> }>([
    { name: 'range requests', headers: { range: 'bytes=0-1' } },
    { name: 'If-None-Match', headers: { 'if-none-match': '*' } },
    { name: 'If-Modified-Since', headers: { 'if-modified-since': new Date(Date.now() + 86_400_000).toUTCString() } },
  ])('ignores $name and returns the full file', async ({ headers }) => {
    const response = await fetch(`${baseUrl}/style.css`, { headers })

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('body{}')
  })

  test('serves the 404 page for an encoded slash instead of decoding it into a path', async () => {
    const response = await fetch(`${baseUrl}/sub%2Findex.html`)

    expect(response.status).toBe(404)
    expect(await response.text()).toBe(CUSTOM_404)
  })

  test('rejects a null byte in the path with 400', async () => {
    const response = await fetch(`${baseUrl}/style%00.css`)

    expect(response.status).toBe(400)
    expect(response.headers.get('cache-control')).toBe(GENERATED_RESPONSE_CACHE_CONTROL)
  })

  test.each(['/%', '/%E0%A4%A'])('rejects the malformed path %s with 400 before adding cache headers', async (path) => {
    const response = await fetch(`${baseUrl}${path}`)

    expect(response.status).toBe(400)
    expect(response.headers.get('cache-control')).toBeNull()
    expect(response.headers.get('age')).toBeNull()
  })

  test.each(['/../outside.txt', '/../outside-dir', '/%2e%2e/outside.txt', '/sub/../index.html'])(
    'rejects the path %s containing a parent segment with 403',
    async (rawPath) => {
      const response = await sendRawRequest(port, rawPath)

      expect(response.status).toBe(403)
      expect(response.body).not.toContain('outside')
    },
  )

  test('does not send validators, range support or a framework banner', async () => {
    const response = await fetch(`${baseUrl}/style.css`)

    expect(response.headers.get('etag')).toBeNull()
    expect(response.headers.get('last-modified')).toBeNull()
    expect(response.headers.get('accept-ranges')).toBeNull()
    expect(response.headers.get('x-powered-by')).toBeNull()
  })

  test('listens on every localhost address and reports the first additional one', async () => {
    const addresses = await lookup('localhost', { all: true })
    const [mainAddress, firstAdditionalAddress = mainAddress] = addresses

    expect(family).toBe(`IPv${String(firstAdditionalAddress.family)}`)
    for (const { address } of addresses) {
      expect(await canConnect(address, port)).toBe(true)
    }
  })

  test('falls back to a plain-text 404 when the site has no 404.html', async () => {
    const { parent, root } = await createSite({ with404Page: false })
    sites.push(parent)
    const otherPort = await getPort()
    await startStaticServer({ settings: { dist: root, frameworkPort: otherPort } })

    const response = await fetch(`http://127.0.0.1:${String(otherPort)}/missing`)

    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toBe(PLAIN)
    expect(await response.text()).toBe('404 Not Found')
  })
})
