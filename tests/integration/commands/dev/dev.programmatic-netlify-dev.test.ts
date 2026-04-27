import fetch from 'node-fetch'
import { describe, test } from 'vitest'

import { withDevServer } from '../../utils/dev-server.js'
import { withSiteBuilder } from '../../utils/site-builder.js'

describe('@netlify/dev integration', () => {
  test('Makes DB available to functions', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withPackageJson({
          packageJson: {
            dependencies: { '@netlify/database': '0.7.0' },
          },
        })
        .withCommand({ command: ['npm', 'install'] })
        .withContentFile({
          path: 'netlify/functions/db-test.mjs',
          content: `
            import { getDatabase } from "@netlify/database";

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

      await withDevServer({ cwd: builder.directory }, async (server) => {
        const response = await fetch(`${server.url}/db-test`)
        const body = await response.text()
        console.log(body)
        t.expect(body).toEqual(JSON.stringify({ sum: 2 }))
      })
    })
  })
})
