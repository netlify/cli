import process from 'process'

import js from 'dedent'
import fetch from 'node-fetch'
import { describe, test } from 'vitest'
import { WebSocket } from 'ws'

import { withDevServer } from '../../utils/dev-server.js'
import { withSiteBuilder, type SiteBuilder } from '../../utils/site-builder.js'

// Serving through Netlify Server requires Node.js 24; on older versions we can
// only test the error surface.
const unsupportedNodeVersion = Number.parseInt(process.versions.node) < 24

const env = { EXPERIMENTAL_NETLIFY_SERVER: 'true' }

const withServerEntry = (builder: SiteBuilder): SiteBuilder =>
  builder.withContentFile({
    path: 'netlify/server/index.mjs',
    // `dedent` converts backslash escapes in the template to the characters
    // they name, so the fixture builds CRLF without any escape sequences.
    content: js`
      import { createHash } from 'node:crypto'
      import { createServer } from 'node:http'

      const CRLF = String.fromCharCode(13, 10)

      const server = createServer((req, res) => {
        let body = ''

        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', () => {
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(
            JSON.stringify({
              source: 'server',
              method: req.method,
              url: req.url,
              body,
              siteID: req.headers['x-nf-site-id'] ?? null,
            }),
          )
        })
      })

      // A hand-rolled WebSocket echo, enough for a single unfragmented text
      // frame, so the fixture needs no dependencies.
      server.on('upgrade', (req, socket) => {
        if (req.url !== '/ws') {
          socket.destroy()

          return
        }

        const accept = createHash('sha1')
          .update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
          .digest('base64')

        socket.write(
          [
            'HTTP/1.1 101 Switching Protocols',
            'Upgrade: websocket',
            'Connection: Upgrade',
            'Sec-WebSocket-Accept: ' + accept,
            CRLF,
          ].join(CRLF),
        )

        socket.on('data', (frame) => {
          const length = frame[1] & 0x7f
          const mask = frame.subarray(2, 6)
          const payload = Buffer.from(frame.subarray(6, 6 + length).map((byte, index) => byte ^ mask[index % 4]))
          const reply = Buffer.from('echo:' + payload.toString())

          socket.write(Buffer.concat([Buffer.from([0x81, reply.length]), reply]))
        })
      })

      server.listen(process.env.PORT)
    `,
  })

describe.concurrent('command/dev Netlify Server', () => {
  test('is inert without the opt-in', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      withServerEntry(builder)

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/some/path`)

        t.expect(response.status).toBe(404)
      })
    })
  })

  test.skipIf(unsupportedNodeVersion)('serves every path from the server when enabled', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      withServerEntry(builder)

      await builder.build()

      await withDevServer({ cwd: builder.directory, env }, async (server) => {
        const response = await fetch(`${server.url}/some/deep/path?value=1`)

        t.expect(response.status).toBe(200)

        const result = (await response.json()) as Record<string, unknown>

        t.expect(result.source).toBe('server')
        t.expect(result.url).toBe('/some/deep/path?value=1')
        t.expect(result.siteID).toBe('unlinked')
      })
    })
  })

  test.skipIf(unsupportedNodeVersion)('forwards request methods and bodies', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      withServerEntry(builder)

      await builder.build()

      await withDevServer({ cwd: builder.directory, env }, async (server) => {
        const response = await fetch(`${server.url}/submit`, {
          body: 'name=netlify',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          method: 'POST',
        })
        const result = (await response.json()) as Record<string, unknown>

        t.expect(result.method).toBe('POST')
        t.expect(result.body).toBe('name=netlify')
      })
    })
  })

  test.skipIf(unsupportedNodeVersion)('static files take precedence over the server', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      withServerEntry(builder)
        .withContentFile({
          path: 'public/asset.txt',
          content: 'from static file',
        })
        .withNetlifyToml({
          config: {
            build: {
              publish: 'public/',
            },
          },
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory, env }, async (server) => {
        const staticResponse = await fetch(`${server.url}/asset.txt`)

        t.expect(await staticResponse.text()).toBe('from static file')

        const serverResponse = await fetch(`${server.url}/not-a-static-file`)
        const result = (await serverResponse.json()) as Record<string, unknown>

        t.expect(result.source).toBe('server')
      })
    })
  })

  test.skipIf(unsupportedNodeVersion)('functions take precedence over the server', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      withServerEntry(builder).withContentFile({
        path: 'netlify/functions/fn.mjs',
        content: js`
          export default async () => new Response('from-function')

          export const config = { path: '/fn' }
        `,
      })

      await builder.build()

      await withDevServer({ cwd: builder.directory, env }, async (server) => {
        const functionResponse = await fetch(`${server.url}/fn`)

        t.expect(await functionResponse.text()).toBe('from-function')

        const serverResponse = await fetch(`${server.url}/not-the-function`)
        const result = (await serverResponse.json()) as Record<string, unknown>

        t.expect(result.source).toBe('server')
      })
    })
  })

  test.skipIf(unsupportedNodeVersion)('pipes WebSocket upgrades to the server', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      withServerEntry(builder)

      await builder.build()

      await withDevServer({ cwd: builder.directory, env }, async (server) => {
        const socket = new WebSocket(`ws://localhost:${String(server.port)}/ws`)

        await new Promise((resolve, reject) => {
          socket.once('open', resolve)
          socket.once('error', reject)
        })

        const reply = new Promise<string>((resolve) => {
          socket.once('message', (message) => {
            resolve((message as Buffer).toString('utf8'))
          })
        })

        socket.send('hello')

        t.expect(await reply).toBe('echo:hello')

        socket.close()
      })
    })
  })

  test.runIf(unsupportedNodeVersion)('fails requests with a clear error on Node.js versions below 24', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      withServerEntry(builder)

      await builder.build()

      await withDevServer({ cwd: builder.directory, env }, async (server) => {
        const response = await fetch(`${server.url}/some/path`)

        t.expect(response.status).toBe(500)
        t.expect(await response.text()).toContain('Netlify Server requires Node.js 24 or above')
      })
    })
  })
})
