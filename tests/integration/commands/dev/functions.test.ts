import { test } from 'vitest'

import { withDevServer } from '../../utils/dev-server'
import { withSiteBuilder } from '../../utils/site-builder'

test('nodeModuleFormat: esm v1 functions should work', async (t) => {
  await withSiteBuilder(t, async (builder) => {
    await builder
      .withNetlifyToml({
        config: {
          plugins: [{ package: './plugins/setup-functions' }],
        },
      })
      .withBuildPlugin({
        name: 'setup-functions',
        plugin: {
          onBuild: async () => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires, n/global-require
            const { mkdir, writeFile } = require('node:fs/promises')
            await mkdir('.netlify/functions-internal', { recursive: true })
            await writeFile(
              '.netlify/functions-internal/server.json',
              JSON.stringify({
                config: {
                  nodeModuleFormat: 'esm',
                },
                version: 1,
              }),
            )

            await writeFile(
              '.netlify/functions-internal/server.mjs',
              `
              export async function handler(event, context) {
                return {
                  statusCode: 200,
                  body: "This is an internal function.",
                };
              }              
              `,
            )
          },
        },
      })
      .build()

    await withDevServer({ cwd: builder.directory, serve: true }, async (server) => {
      const response = await fetch(new URL('/.netlify/functions/server', server.url))
      t.expect(await response.text()).toBe("This is an internal function.")
      t.expect(response.status).toBe(200)
    })
  })
})
