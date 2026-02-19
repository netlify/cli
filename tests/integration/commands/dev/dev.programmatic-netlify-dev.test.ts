import fetch from 'node-fetch'
import { describe, test } from 'vitest'

import { withDevServer } from '../../utils/dev-server.js'
import { withSiteBuilder } from '../../utils/site-builder.js'

describe('@netlify/dev integration', () => {
  test('Makes DB available to functions when EXPERIMENTAL_NETLIFY_DB_ENABLED is set', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withPackageJson({
          packageJson: {
            dependencies: { '@netlify/db': '0.1.0', '@netlify/db-dev': '0.2.0' },
          },
        })
        .withCommand({ command: ['npm', 'install'] })
        .withContentFile({
          path: 'netlify/functions/db-test.mjs',
          content: `
            import { getDatabase } from "@netlify/db";

            export default async () => {
              try {
                const { sql } = getDatabase();
                const rows = await sql\`SELECT 1 + 1 AS sum\`;
                return Response.json({ sum: rows[0].sum });
              } catch (error) {
                return Response.json({ error: error.message }, { status: 500 });
              }
            };

            export const config = { path: "/db-test" };
          `,
        })

      await builder.build()

      await withDevServer({ cwd: builder.directory, env: { EXPERIMENTAL_NETLIFY_DB_ENABLED: '1' } }, async (server) => {
        const response = await fetch(`${server.url}/db-test`)
        const body = await response.text()
        console.log(body)
        t.expect(body).toEqual(JSON.stringify({ sum: 2 }))
      })
    })
  })

  test('Does not set NETLIFY_DB_URL when EXPERIMENTAL_NETLIFY_DB_ENABLED is not set', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder.withFunction({
        path: 'db-url.mjs',
        pathPrefix: 'netlify/functions',
        runtimeAPIVersion: 2,
        config: { path: '/db-url' },
        handler: () => Response.json({ url: process.env.NETLIFY_DB_URL ?? '' }),
      })

      await builder.build()

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/db-url`)
        const body = await response.text()
        console.log(body)

        t.expect(response.status).toBe(200)
        t.expect(body).toEqual(JSON.stringify({ url: '' }))
      })
    })
  })
})
