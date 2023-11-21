// Handlers are meant to be async outside tests
import fs from 'fs'
import path from 'path'

import fetch from 'node-fetch'
import { describe, test } from 'vitest'

import { IMAGE_URL_PATTERN } from '../../../../src/lib/images/proxy.js'
import { withDevServer } from '../../utils/dev-server.js'
import { withSiteBuilder } from '../../utils/site-builder.js'

describe.concurrent('commands/dev/images', () => {
  test(`should support remote image transformations`, async (t) => {
    await withSiteBuilder('site-with-image-transformations', async (builder) => {
      builder
        .withNetlifyToml({
          config: {
            images: {
              remote_images: ['https://images.unsplash.com/*'],
            },
          },
        })
        .withContentFile({
          content: `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Test</title>
            </head>
            <body>
              <img src="https://images.unsplash.com/photo-1517849845537-4d257902454a" />
            </body>
          </html>
        `,
          path: 'index.html',
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        await fetch(
          `${server.url}${IMAGE_URL_PATTERN}?url=https://images.unsplash.com/photo-1517849845537-4d257902454a&w=100&h=200&q=80&fm=avif&fit=cover&position=left`,
          {},
        ).then((res) => {
          t.expect(res.status).toEqual(200)
          t.expect(res.headers.get('content-type')).toEqual('image/avif')
          return res.buffer()
        })
      })
    })
  })

  test(`should support local image transformations for relative paths`, async (t) => {
    await withSiteBuilder('site-with-image-transformations', async (builder) => {
      builder
        .withContentFile({
          content: `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Test</title>
            </head>
            <body>
              <img src="/images/test.jpg" />
            </body>
          </html>
        `,
          path: 'index.html',
        })
        .withContentFile({
          // eslint-disable-next-line no-undef
          content: fs.readFileSync(path.join(__dirname, `/../../__fixtures__/images/test.jpg`)),
          path: '/images/test.jpg',
        })

      await builder.buildAsync()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        await fetch(
          `${server.url}${IMAGE_URL_PATTERN}?url=/images/test.jpg&w=100&h=200&q=80&fm=avif&fit=cover&position=left`,
          {},
        ).then((res) => {
          t.expect(res.status).toEqual(200)
          t.expect(res.headers.get('content-type')).toEqual('image/avif')
          return res.buffer()
        })
      })
    })
  })
})
