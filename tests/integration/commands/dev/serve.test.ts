import { expect, test } from 'vitest'

import { withDevServer } from '../../utils/dev-server.js'
import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'
import { withSiteBuilder } from '../../utils/site-builder.js'

setupFixtureTests('plugin-changing-publish-dir', { devServer: { serve: true } }, () => {
  test<FixtureTestContext>('ntl serve should respect plugins changing publish dir', async ({ devServer }) => {
    const response = await fetch(`http://localhost:${devServer.port}/`)
    expect(response.status).toBe(200)
  })
})

test.skipIf(process.env.NETLIFY_TEST_DISABLE_LIVE === 'true')('ntl serve should upload file-based blobs', async (t) => {
  await withSiteBuilder(t, async (builder) => {
    await builder
      .withNetlifyToml({
        config: {
          plugins: [{ package: './plugins/deployblobs' }],
        },
      })
      .withBuildPlugin({
        name: 'deployblobs',
        plugin: {
          async onBuild() {
            const { mkdir, writeFile } = require('node:fs/promises')
            await mkdir('.netlify/blobs/deploy', { recursive: true })
            await writeFile('.netlify/blobs/deploy/foo.txt', 'foo')
          },
        },
      })
      .withContentFile({
        path: 'netlify/functions/index.ts',
        content: `
        import { getDeployStore } from "@netlify/blobs";

        export default async (request: Request) => {
          const store = getDeployStore();
          const blob = await store.get(new URL(request.url).pathname.slice(1))
          return new Response(blob ?? "Not Found");
        };
        export const config = { path: "/*" };
        `,
      })
      .withContentFile({
        path: 'package.json',
        content: JSON.stringify({
          dependencies: {
            '@netlify/blobs': '*',
          },
        }),
      })
      .withCommand({ command: ['npm', 'install'] })
      .build()

    await withDevServer({ cwd: builder.directory, serve: true }, async ({ url }) => {
      const response = await fetch(new URL('/foo.txt', url)).then((res) => res.text())
      t.expect(response).toEqual('foo')
    })
  })
})
