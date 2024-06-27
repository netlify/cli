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
          build: {
            command: 'node build.mjs',
          },
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
      .withFunction({
        config: { path: '/framework-function-1' },
        path: 'framework-1.js',
        pathPrefix: 'frameworks-api-seed/functions',
        handler: async () => new Response('Frameworks API Function 1'),
        runtimeAPIVersion: 2,
      })
      .withContentFile({
        content: `
          import { cp, readdir } from "fs/promises";
          import { resolve } from "path";

          const seedPath = resolve("frameworks-api-seed");
          const destPath = resolve(".netlify/v1");

          await cp(seedPath, destPath, { recursive: true });
        `,
        path: 'build.mjs',
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
      const response1 = await fetch(new URL('/foo.txt', url))
      t.expect(await response1.text()).toEqual('foo')

      const response2 = await fetch(new URL('/framework-function-1', url))
      t.expect(await response2.text()).toEqual('Frameworks API Function 1')
    })
  })
})
