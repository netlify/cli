import path from 'path'
import process from 'process'
import { fileURLToPath } from 'url'

import { load } from 'cheerio'
import execa from 'execa'
import fetch from 'node-fetch'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { createLiveTestSite, generateSiteName } from '../../utils/create-live-test-site.js'
import { FixtureTestContext, setupFixtureTests } from '../../utils/fixture.js'
import { pause } from '../../utils/pause.js'
import { withSiteBuilder } from '../../utils/site-builder.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SITE_NAME = generateSiteName('netlify-test-deploy-')

const validateContent = async ({
  content,
  headers,
  path: pathname,
  siteUrl,
}: {
  content?: string | undefined
  headers?: Record<string, string>
  path: string
  pathname?: string | undefined
  siteUrl: string
}) => {
  const response = await fetch(`${siteUrl}${pathname}`, { headers })
  const body = await response.text()
  if (content === undefined) {
    expect(response.status).toBe(404)
    return
  }
  expect(response.status, `status should be 200. request id: ${response.headers.get('x-nf-request-id') ?? ''}`).toBe(
    200,
  )
  expect(body, `body should be as expected. request id: ${response.headers.get('x-nf-request-id') ?? ''}`).toEqual(
    content,
  )
}

type Deploy = {
  summary: {
    messages: {
      title: string
      description: string
    }[]
  }
  site_id: string
  site_name: string
  deploy_url: string
  deploy_id: string
  logs: string
  function_logs: string
  edge_function_logs: string
}

const validateDeploy = async ({
  content,
  deploy,
  siteName,
}: {
  contentMessage?: string
  siteName: string
  content?: string
  deploy: Deploy
}) => {
  expect(deploy.site_id).toBeTruthy()
  expect(deploy.site_name).toBeTruthy()
  expect(deploy.deploy_url).toBeTruthy()
  expect(deploy.deploy_id).toBeTruthy()
  expect(deploy.logs).toBeTruthy()
  expect(deploy.function_logs).toBeTruthy()
  expect(deploy.edge_function_logs).toBeTruthy()
  expect(deploy.site_name).toEqual(siteName)

  await validateContent({ siteUrl: deploy.deploy_url, path: '', content })
}

const context: { account: unknown; siteId: string } = {
  siteId: '',
  account: undefined,
}

describe.skipIf(process.env.NETLIFY_TEST_DISABLE_LIVE === 'true').concurrent('commands/deploy', () => {
  beforeAll(async () => {
    const { account, siteId } = await createLiveTestSite(SITE_NAME)
    context.siteId = siteId
    context.account = account
  })

  afterAll(async () => {
    const { siteId } = context
    console.log(`deleting test site "${SITE_NAME}". ${siteId}`)
    await callCli(['sites:delete', siteId, '--force'])
  })

  test('should deploy project when dir flag is passed', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const content = '<h1>⊂◉‿◉つ</h1>'
      builder.withContentFile({
        path: 'public/index.html',
        content,
      })

      await builder.build()

      const deploy = await callCli(['deploy', '--json', '--no-build', '--dir', 'public'], {
        cwd: builder.directory,
        env: { NETLIFY_SITE_ID: context.siteId },
      }).then((output: string) => JSON.parse(output))

      await validateDeploy({ deploy, siteName: SITE_NAME, content })
    })
  })

  test('should deploy project by name', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const content = '<h1>⊂◉‿◉つ</h1>'
      builder
        .withContentFile({
          path: 'public/index.html',
          content,
        })
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
          },
        })

      await builder.build()

      const deploy = await callCli(['deploy', '--json', '--no-build', '--site', SITE_NAME], {
        cwd: builder.directory,
      }).then((output: string) => JSON.parse(output))

      await validateDeploy({ deploy, siteName: SITE_NAME, content })
    })
  })

  test('should deploy project when publish directory set in netlify.toml', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const content = '<h1>⊂◉‿◉つ</h1>'
      builder
        .withContentFile({
          path: 'public/index.html',
          content,
        })
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
          },
        })

      await builder.build()

      const deploy = await callCli(['deploy', '--json', '--no-build'], {
        cwd: builder.directory,
        env: { NETLIFY_SITE_ID: context.siteId },
      }).then((output: string) => JSON.parse(output))

      await validateDeploy({ deploy, siteName: SITE_NAME, content })
    })
  })

  test('should deploy Edge Functions when directory exists', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const content = 'Edge Function works NOT'
      builder
        .withContentFile({
          path: 'public/index.html',
          content,
        })
        .withNetlifyToml({
          config: {
            build: { publish: 'public', command: 'echo "no op"' },
            edge_functions: [{ function: 'edge', path: '/*' }],
          },
        })
        .withEdgeFunction({
          handler: async () => new Response('Edge Function works'),
          name: 'edge',
        })

      await builder.build()

      const options = {
        cwd: builder.directory,
        env: { NETLIFY_SITE_ID: context.siteId },
      }

      await callCli(['build'], options)
      const deploy = await callCli(['deploy', '--json', '--no-build'], options).then((output: string) =>
        JSON.parse(output),
      )

      // give edge functions manifest a couple ticks to propagate
      await pause(500)

      await validateDeploy({
        deploy,
        siteName: SITE_NAME,
        content: 'Edge Function works',
        contentMessage: 'Edge function did not execute correctly or was not deployed correctly',
      })
    })
  })

  test('should deploy Edge Functions with custom cwd when directory exists', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const content = 'Edge Function works NOT'
      const pathPrefix = 'app/cool'
      builder
        .withContentFile({
          path: 'app/cool/public/index.html',
          content,
        })
        .withNetlifyToml({
          config: {
            build: { publish: 'public', command: 'echo "no op"' },
            edge_functions: [{ function: 'edge', path: '/*' }],
          },
          pathPrefix,
        })
        .withEdgeFunction({
          handler: async () => new Response('Edge Function works'),
          name: 'edge',
          pathPrefix,
        })

      await builder.build()

      const options = {
        cwd: builder.directory,
        env: { NETLIFY_SITE_ID: context.siteId },
      }

      await callCli(['build', '--cwd', pathPrefix], options)
      const deploy = await callCli(['deploy', '--json', '--no-build', '--cwd', pathPrefix], options).then(
        (output: string) => JSON.parse(output),
      )

      // give edge functions manifest a couple ticks to propagate
      await pause(500)

      await validateDeploy({
        deploy,
        siteName: SITE_NAME,
        content: 'Edge Function works',
        contentMessage: 'Edge function did not execute correctly or was not deployed correctly',
      })
    })
  })

  test('runs build command before deploy by default', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const content = '<h1>⊂◉‿◉つ</h1>'
      builder
        .withContentFile({
          path: 'public/index.html',
          content,
        })
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            plugins: [{ package: './plugins/log-env' }],
          },
        })
        .withBuildPlugin({
          name: 'log-env',
          plugin: {
            async onSuccess() {
              const { DEPLOY_ID, DEPLOY_URL } = require('process').env
              console.log(`DEPLOY_ID: ${DEPLOY_ID}`)
              console.log(`DEPLOY_URL: ${DEPLOY_URL}`)
            },
          },
        })

      await builder.build()

      const output: string = await callCli(['deploy'], {
        cwd: builder.directory,
        env: { NETLIFY_SITE_ID: context.siteId },
      })

      t.expect(output).toContain('Netlify Build completed in')
      const [, deployId] = output.match(/DEPLOY_ID: (\w+)/) ?? []
      const [, deployURL] = output.match(/DEPLOY_URL: (.+)/) ?? []

      t.expect(deployId).not.toEqual('0')
      t.expect(deployURL).toContain(`https://${deployId}--`)
    })
  })

  test('warns and proceeds if extraneous `--build` is explicitly passed', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const content = '<h1>⊂◉‿◉つ</h1>'
      builder
        .withContentFile({
          path: 'public/index.html',
          content,
        })
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            plugins: [{ package: './plugins/log-env' }],
          },
        })
        .withBuildPlugin({
          name: 'log-env',
          plugin: {
            async onSuccess() {
              const { DEPLOY_ID, DEPLOY_URL } = require('process').env
              console.log(`DEPLOY_ID: ${DEPLOY_ID}`)
              console.log(`DEPLOY_URL: ${DEPLOY_URL}`)
            },
          },
        })

      await builder.build()

      const output: string = await callCli(['deploy', '--build'], {
        cwd: builder.directory,
        env: { NETLIFY_SITE_ID: context.siteId },
      })

      t.expect(output).toMatch(/--build.+is now the default and can safely be omitted./)

      t.expect(output).toContain('Netlify Build completed in')
      const [, deployId] = output.match(/DEPLOY_ID: (\w+)/) ?? []
      const [, deployURL] = output.match(/DEPLOY_URL: (.+)/) ?? []

      t.expect(deployId).not.toEqual('0')
      t.expect(deployURL).toContain(`https://${deployId}--`)
    })
  })

  test('should return valid json when --json is passed', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const content = '<h1>⊂◉‿◉つ</h1>'
      builder
        .withContentFile({
          path: 'public/index.html',
          content,
        })
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
          },
        })

      await builder.build()

      const output: string = await callCli(['deploy', '--json'], {
        cwd: builder.directory,
        env: { NETLIFY_SITE_ID: context.siteId },
      })

      expect(() => JSON.parse(output)).not.toThrowError()
    })
  })

  test('does not run build command and build plugins before deploy when --no-build flag is passed', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const content = '<h1>⊂◉‿◉つ</h1>'
      builder
        .withContentFile({
          path: 'public/index.html',
          content,
        })
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            plugins: [{ package: './plugins/log-hello' }],
          },
        })
        .withBuildPlugin({
          name: 'log-hello',
          plugin: {
            async onSuccess() {
              console.log('Hello from a build plugin')
            },
          },
        })

      await builder.build()

      const output: string = await callCli(['deploy', '--no-build'], {
        cwd: builder.directory,
        env: { NETLIFY_SITE_ID: context.siteId },
      })

      t.expect(output).not.toContain('Netlify Build completed in')
      t.expect(output).not.toContain('Hello from a build plugin')
    })
  })

  test('should print deploy-scoped URLs for build logs, function logs, and edge function logs', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const content = '<h1>Why Next.js is perfect, an essay</h1>'
      builder.withContentFile({
        path: 'public/index.html',
        content,
      })
      await builder.build()

      const deploy = await callCli(['deploy', '--json', '--no-build', '--dir', 'public'], {
        cwd: builder.directory,
        env: { NETLIFY_SITE_ID: context.siteId },
      }).then((output: string) => JSON.parse(output))

      await validateDeploy({ deploy, siteName: SITE_NAME, content })
      expect(deploy).toHaveProperty('logs', `https://app.netlify.com/projects/${SITE_NAME}/deploys/${deploy.deploy_id}`)
      expect(deploy).toHaveProperty(
        'function_logs',
        `https://app.netlify.com/projects/${SITE_NAME}/logs/functions?scope=deploy:${deploy.deploy_id}`,
      )
      expect(deploy).toHaveProperty(
        'edge_function_logs',
        `https://app.netlify.com/projects/${SITE_NAME}/logs/edge-functions?scope=deployid:${deploy.deploy_id}`,
      )
    })
  })

  test('should print production URLs for build logs, function logs, and edge function logs when --prod is passed', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const content = '<h1>Why Next.js is perfect, a novella</h1>'
      builder.withContentFile({
        path: 'public/index.html',
        content,
      })
      await builder.build()

      const deploy = await callCli(['deploy', '--json', '--no-build', '--dir', 'public', '--prod'], {
        cwd: builder.directory,
        env: { NETLIFY_SITE_ID: context.siteId },
      }).then((output: string) => JSON.parse(output))

      await validateDeploy({ deploy, siteName: SITE_NAME, content })
      expect(deploy).toHaveProperty('logs', `https://app.netlify.com/projects/${SITE_NAME}/deploys/${deploy.deploy_id}`)
      expect(deploy).toHaveProperty('function_logs', `https://app.netlify.com/projects/${SITE_NAME}/logs/functions`)
      expect(deploy).toHaveProperty(
        'edge_function_logs',
        `https://app.netlify.com/projects/${SITE_NAME}/logs/edge-functions`,
      )
    })
  })

  test('should throw error when build fails with --json option', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withContentFile({
          path: 'public/index.html',
          content: '<h1>Test content</h1>',
        })
        .withNetlifyToml({
          config: {
            build: {
              publish: 'public',
              command: 'echo "Build failed with custom error" >&2 && exit 1',
            },
          },
        })

      await builder.build()

      await expect(
        callCli(['deploy', '--json'], {
          cwd: builder.directory,
          env: { NETLIFY_SITE_ID: context.siteId },
        }),
      ).rejects.toThrow(/Error while running build.*Build failed with custom error/)
    })
  })

  test('should throw error without stderr details when build fails with --json option and no stderr output', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withContentFile({
          path: 'public/index.html',
          content: '<h1>Test content</h1>',
        })
        .withNetlifyToml({
          config: {
            build: {
              publish: 'public',
              command: 'exit 1',
            },
          },
        })

      await builder.build()

      await expect(
        callCli(['deploy', '--json'], {
          cwd: builder.directory,
          env: { NETLIFY_SITE_ID: context.siteId },
        }),
      ).rejects.toThrow('Error while running build')
    })
  })

  test('should include stdout and stderr when build fails with --json --verbose options', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withContentFile({
          path: 'public/index.html',
          content: '<h1>Test content</h1>',
        })
        .withNetlifyToml({
          config: {
            build: {
              publish: 'public',
              command:
                "node -e \"process.stdout.write('Build output'); process.stderr.write('Build error'); process.exit(1)\"",
            },
          },
        })

      await builder.build()

      await expect(
        callCli(['deploy', '--json', '--verbose'], {
          cwd: builder.directory,
          env: { NETLIFY_SITE_ID: context.siteId },
        }),
      ).rejects.toThrow('Build output')
    })
  })

  test('should deploy hidden public folder but ignore hidden/__MACOSX files', { retry: 3 }, async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withContentFiles([
          {
            path: '.public/index.html',
            content: 'index',
          },
          {
            path: '.public/.hidden-file.html',
            content: 'hidden-file',
          },
          {
            path: '.public/.hidden-dir/index.html',
            content: 'hidden-dir',
          },
          {
            path: '.public/__MACOSX/index.html',
            content: 'macosx',
          },
        ])
        .withNetlifyToml({
          config: {
            build: { publish: '.public' },
          },
        })

      await builder.build()

      const deploy = await callCli(['deploy', '--json', '--no-build'], {
        cwd: builder.directory,
        env: { NETLIFY_SITE_ID: context.siteId },
      }).then((output: string) => JSON.parse(output))

      await validateDeploy({ deploy, siteName: SITE_NAME, content: 'index' })
      await validateContent({
        siteUrl: deploy.deploy_url,
        content: undefined,
        path: '/.hidden-file',
      })
      await validateContent({
        siteUrl: deploy.deploy_url,
        content: undefined,
        path: '/.hidden-dir',
      })
      await validateContent({
        siteUrl: deploy.deploy_url,
        content: undefined,
        path: '/__MACOSX',
      })
    })
  })

  test('should filter node_modules from root directory', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withContentFiles([
          {
            path: 'index.html',
            content: 'index',
          },
          {
            path: 'node_modules/package.json',
            content: '{}',
          },
        ])
        .withNetlifyToml({
          config: {
            build: { publish: '.' },
          },
        })

      await builder.build()

      const deploy = await callCli(['deploy', '--json', '--no-build'], {
        cwd: builder.directory,
        env: { NETLIFY_SITE_ID: context.siteId },
      }).then((output: string) => JSON.parse(output))

      await validateDeploy({ deploy, siteName: SITE_NAME, content: 'index' })
      await validateContent({
        siteUrl: deploy.deploy_url,
        content: undefined,
        path: '/node_modules/package.json',
      })
    })
  })

  test('should not filter node_modules from publish directory', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      builder
        .withContentFiles([
          {
            path: 'public/index.html',
            content: 'index',
          },
          {
            path: 'public/node_modules/package.json',
            content: '{}',
          },
        ])
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
          },
        })

      await builder.build()

      const deploy = await callCli(['deploy', '--json', '--no-build'], {
        cwd: builder.directory,
        env: { NETLIFY_SITE_ID: context.siteId },
      }).then((output: string) => JSON.parse(output))

      await validateDeploy({ deploy, siteName: SITE_NAME, content: 'index' })
      await validateContent({
        siteUrl: deploy.deploy_url,
        content: '{}',
        path: '/node_modules/package.json',
      })
    })
  })

  test('should exit with error when deploying an empty directory', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      try {
        await callCli(['deploy', '--no-build', '--dir', '.'], {
          cwd: builder.directory,
          env: { NETLIFY_SITE_ID: context.siteId },
        })
      } catch (error) {
        expect(error).toHaveProperty('stderr', expect.stringContaining('Error: No files or functions to deploy'))
      }
    })
  })

  test('refreshes configuration when building before deployment', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withContentFile({
          path: 'public/index.html',
          content: '<h1>⊂◉‿◉つ</h1>',
        })
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions' },
            plugins: [{ package: './plugins/mutator' }],
          },
        })
        .withBuildPlugin({
          name: 'mutator',
          plugin: {
            onPreBuild: async ({ netlifyConfig }) => {
              const { mkdir, writeFile } = require('node:fs/promises') as typeof import('node:fs/promises')

              const generatedFunctionsDir = 'new_functions'
              // @ts-expect-error
              netlifyConfig.functions.directory = generatedFunctionsDir

              await mkdir(generatedFunctionsDir)
              await writeFile(
                `${generatedFunctionsDir}/hello.js`,
                `exports.handler = async () => ({ statusCode: 200, body: 'Hello' })`,
              )
            },
          },
        })
        .build()

      const { deploy_url: deployUrl } = (await callCli(
        ['deploy', '--json'],
        {
          cwd: builder.directory,
          env: { NETLIFY_SITE_ID: context.siteId },
        },
        true,
      )) as unknown as Deploy

      const response = await fetch(`${deployUrl}/.netlify/functions/hello`)
      t.expect(await response.text()).toEqual('Hello')
      t.expect(response.status).toBe(200)
    })
  })

  test('should deploy functions from internal functions directory and Frameworks API', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withNetlifyToml({
          config: {
            build: {
              command: 'node build.mjs',
            },
            functions: { directory: 'functions' },
          },
        })
        .withFunction({
          path: 'func-1.js',
          handler: async () => ({
            statusCode: 200,
            body: 'User 1',
          }),
        })
        .withFunction({
          path: 'func-2.js',
          handler: async () => ({
            statusCode: 200,
            body: 'User 2',
          }),
        })
        .withFunction({
          path: 'func-2.js',
          pathPrefix: '.netlify/functions-internal',
          handler: async () => ({
            statusCode: 200,
            body: 'Internal 2',
          }),
        })
        .withFunction({
          path: 'func-3.js',
          pathPrefix: '.netlify/functions-internal',
          handler: async () => ({
            statusCode: 200,
            body: 'Internal 3',
          }),
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
          export default async () => new Response("Internal V2 API")
          export const config = {
            path: "/internal-v2-func",
            rateLimit: {
              windowLimit: 60,
              windowSize: 50,
              aggregateBy: ["ip", "domain"],
            }
          }
          `,
          path: '.netlify/functions-internal/func-4.mjs',
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
        .withEdgeFunction({
          config: {
            path: '/framework-edge-function-1',
          },
          handler: `
            import { greeting } from 'alias:util';

            export default async () => new Response(greeting + ' from Frameworks API edge function 1');
          `,
          path: 'frameworks-api-seed/edge-functions',
        })
        .withContentFile({
          content: `export const greeting = 'Hello'`,
          path: 'frameworks-api-seed/edge-functions/lib/util.ts',
        })
        .withContentFile({
          content: JSON.stringify({ imports: { 'alias:util': './lib/util.ts' } }),
          path: 'frameworks-api-seed/edge-functions/import_map.json',
        })
        .build()

      const { deploy_url: deployUrl } = (await callCli(
        ['deploy', '--json'],
        {
          cwd: builder.directory,
          env: { NETLIFY_SITE_ID: context.siteId },
        },
        true,
      )) as unknown as Deploy

      // Add retry logic for fetching deployed functions
      const fetchWithRetry = async (url: string, maxRetries = 5) => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            return await fetch(url)
          } catch (error) {
            if (i === maxRetries - 1) throw error
            await pause(2000 * (i + 1)) // Exponential backoff: 2s, 4s, 6s, 8s
          }
        }
        throw new Error(`Failed to fetch ${url} after ${maxRetries} retries`)
      }

      const [response1, response2, response3, response4, response5, response6, response7] = await Promise.all([
        fetchWithRetry(`${deployUrl}/.netlify/functions/func-1`).then((res) => res.text()),
        fetchWithRetry(`${deployUrl}/.netlify/functions/func-2`).then((res) => res.text()),
        fetchWithRetry(`${deployUrl}/.netlify/functions/func-3`).then((res) => res.text()),
        fetchWithRetry(`${deployUrl}/.netlify/functions/func-4`),
        fetchWithRetry(`${deployUrl}/internal-v2-func`).then((res) => res.text()),
        fetchWithRetry(`${deployUrl}/framework-function-1`).then((res) => res.text()),
        fetchWithRetry(`${deployUrl}/framework-edge-function-1`).then((res) => res.text()),
      ])

      t.expect(response1).toEqual('User 1')
      t.expect(response2).toEqual('User 2')
      t.expect(response3).toEqual('Internal 3')
      t.expect(response4.status).toBe(404)
      t.expect(response5).toEqual('Internal V2 API')
      t.expect(response6).toEqual('Frameworks API Function 1')
      t.expect(response7).toEqual('Hello from Frameworks API edge function 1')
    })
  })

  test('should deploy functions from internal functions directory when setting `base` to a sub-directory', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withNetlifyToml({
          config: {
            build: { base: 'sub-directory' },
            functions: { directory: 'functions' },
          },
        })
        .withFunction({
          path: 'func-1.js',
          pathPrefix: 'sub-directory/.netlify/functions-internal',
          handler: async () => ({
            statusCode: 200,
            body: 'Internal',
          }),
        })
        .build()

      const { deploy_url: deployUrl } = (await callCli(
        ['deploy', '--json'],
        {
          cwd: builder.directory,
          env: { NETLIFY_SITE_ID: context.siteId },
        },
        true,
      )) as unknown as Deploy
      const response = await fetch(`${deployUrl}/.netlify/functions/func-1`).then((res) => res.text())

      t.expect(response).toEqual('Internal')
    })
  })

  test('should handle redirects mutated by plugins', { retry: 3 }, async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const content = '<h1>⊂◉‿◉つ</h1>'
      await builder
        .withContentFile({
          path: 'public/index.html',
          content,
        })
        .withNetlifyToml({
          config: {
            build: { publish: 'public' },
            functions: { directory: 'functions' },
            redirects: [{ from: '/*', to: '/index.html', status: 200 }],
            plugins: [{ package: './plugins/mutator' }],
          },
        })
        .withFunction({
          path: 'hello.js',
          handler: async () => ({
            statusCode: 200,
            body: 'hello',
          }),
        })
        .withRedirectsFile({
          pathPrefix: 'public',
          redirects: [{ from: `/api/*`, to: `/.netlify/functions/:splat`, status: '200' }],
        })
        .withBuildPlugin({
          name: 'mutator',
          plugin: {
            onPostBuild: ({ netlifyConfig }) => {
              netlifyConfig.redirects = [
                {
                  from: '/other-api/*',
                  to: '/.netlify/functions/:splat',
                  status: 200,
                },
                ...netlifyConfig.redirects,
              ]
            },
          },
        })
        .build()

      const deploy = (await callCli(
        ['deploy', '--json'],
        {
          cwd: builder.directory,
          env: { NETLIFY_SITE_ID: context.siteId },
        },
        true,
      )) as unknown as Deploy

      const fullDeploy = (await callCli(
        ['api', 'getDeploy', '--data', JSON.stringify({ deploy_id: deploy.deploy_id })],
        {
          cwd: builder.directory,
          env: { NETLIFY_SITE_ID: context.siteId },
        },
        true,
      )) as unknown as Deploy

      const redirectsMessage = fullDeploy.summary.messages.find(({ title }) => title === '3 redirect rules processed')
      t.expect(redirectsMessage).toBeDefined()
      t.expect(redirectsMessage!.description).toEqual('All redirect rules deployed without errors.')

      await validateDeploy({ deploy, siteName: SITE_NAME, content })

      const [pluginRedirectResponse, _redirectsResponse, netlifyTomResponse] = await Promise.all([
        fetch(`${deploy.deploy_url}/other-api/hello`).then((res) => res.text()),
        fetch(`${deploy.deploy_url}/api/hello`).then((res) => res.text()),
        fetch(`${deploy.deploy_url}/not-existing`).then((res) => res.text()),
      ])

      // plugin redirect
      t.expect(pluginRedirectResponse).toEqual('hello')
      // _redirects redirect
      t.expect(_redirectsResponse).toEqual('hello')
      // netlify.toml redirect
      t.expect(netlifyTomResponse).toEqual(content)
    })
  })

  test('should deploy pre-bundled functions when a valid manifest file is found', async (t) => {
    const bundledFunctionPath = path.join(__dirname, '../../assets', 'bundled-function-1.zip')
    const bundledFunctionData = {
      mainFile: '/some/path/bundled-function-1.js',
      name: 'bundled-function-1',
      runtime: 'js',
    }

    await withSiteBuilder(t, async (builder) => {
      await builder
        .withNetlifyToml({
          config: {
            build: { publish: 'out' },
            functions: { directory: 'functions' },
          },
        })
        .withCopiedFile({
          src: bundledFunctionPath,
          path: '.netlify/functions/bundled-function-1.zip',
        })
        .withContentFile({
          path: '.netlify/functions/manifest.json',
          content: JSON.stringify({
            functions: [
              {
                ...bundledFunctionData,
                path: path.join(builder.directory, '.netlify', 'functions', 'bundled-function-1.zip'),
              },
            ],
            timestamp: Date.now(),
            version: 1,
          }),
        })
        .withContentFile({
          path: 'out/index.html',
          content: 'Hello world',
        })
        .withFunction({
          path: 'bundled-function-1.js',
          handler: async () => ({
            statusCode: 200,
            body: 'Bundled at deployment',
          }),
        })
        .build()

      const { deploy_url: deployUrl } = (await callCli(
        ['deploy', '--json', '--no-build'],
        {
          cwd: builder.directory,
          env: { NETLIFY_SITE_ID: context.siteId },
        },
        true,
      )) as unknown as Deploy
      const response = await fetch(`${deployUrl}/.netlify/functions/bundled-function-1`).then((res) => res.text())
      expect(response).toEqual('Pre-bundled')
    })
  })

  test('should not deploy pre-bundled functions when the --skip-functions-cache flag is used', async (t) => {
    const bundledFunctionPath = path.join(__dirname, '../../assets', 'bundled-function-1.zip')
    const bundledFunctionData = {
      mainFile: '/some/path/bundled-function-1.js',
      name: 'bundled-function-1',
      runtime: 'js',
    }

    await withSiteBuilder(t, async (builder) => {
      await builder
        .withNetlifyToml({
          config: {
            build: { publish: 'out' },
            functions: { directory: 'functions' },
          },
        })
        .withCopiedFile({
          src: bundledFunctionPath,
          path: '.netlify/functions/bundled-function-1.zip',
        })
        .withContentFile({
          path: '.netlify/functions/manifest.json',
          content: JSON.stringify({
            functions: [
              {
                ...bundledFunctionData,
                path: path.join(builder.directory, '.netlify', 'functions', 'bundled-function-1.zip'),
              },
            ],
            timestamp: Date.now(),
            version: 1,
          }),
        })
        .withContentFile({
          path: 'out/index.html',
          content: 'Hello world',
        })
        .withFunction({
          path: 'bundled-function-1.js',
          handler: async () => ({
            statusCode: 200,
            body: 'Bundled at deployment',
          }),
        })
        .build()

      const { deploy_url: deployUrl } = (await callCli(
        ['deploy', '--json', '--no-build', '--skip-functions-cache'],
        {
          cwd: builder.directory,
          env: { NETLIFY_SITE_ID: context.siteId },
        },
        true,
      )) as unknown as Deploy

      const response = await fetch(`${deployUrl}/.netlify/functions/bundled-function-1`).then((res) => res.text())
      t.expect(response).toEqual('Bundled at deployment')
    })
  })

  test('should not deploy pre-bundled functions when the manifest file is older than the configured TTL', async (t) => {
    const age = 18e4
    const bundledFunctionPath = path.join(__dirname, '../../assets', 'bundled-function-1.zip')
    const bundledFunctionData = {
      mainFile: '/some/path/bundled-function-1.js',
      name: 'bundled-function-1',
      runtime: 'js',
    }

    await withSiteBuilder(t, async (builder) => {
      await builder
        .withNetlifyToml({
          config: {
            build: { publish: 'out' },
            functions: { directory: 'functions' },
          },
        })
        .withCopiedFile({
          src: bundledFunctionPath,
          path: '.netlify/functions/bundled-function-1.zip',
        })
        .withContentFile({
          path: '.netlify/functions/manifest.json',
          content: JSON.stringify({
            functions: [
              {
                ...bundledFunctionData,
                path: path.join(builder.directory, '.netlify', 'functions', 'bundled-function-1.zip'),
              },
            ],
            timestamp: Date.now() - age,
            version: 1,
          }),
        })
        .withContentFile({
          path: 'out/index.html',
          content: 'Hello world',
        })
        .withFunction({
          path: 'bundled-function-1.js',
          handler: async () => ({
            statusCode: 200,
            body: 'Bundled at deployment',
          }),
        })
        .build()

      const { deploy_url: deployUrl } = (await callCli(
        ['deploy', '--json', '--no-build'],
        {
          cwd: builder.directory,
          env: { NETLIFY_SITE_ID: context.siteId },
        },
        true,
      )) as unknown as { deploy_url: string }

      const response = await fetch(`${deployUrl}/.netlify/functions/bundled-function-1`).then((res) => res.text())
      t.expect(response).toEqual('Bundled at deployment')
    })
  })

  test('should upload blobs when saved into .netlify directory', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withNetlifyToml({
          config: {
            build: { functions: 'functions', publish: 'dist' },
          },
        })
        .withContentFile({
          path: 'dist/index.html',
          content: '<a href="/read-blob">get blob</a>',
        })
        .withContentFile({
          path: '.netlify/blobs/deploy/hello',
          content: 'hello from the blob',
        })
        .withPackageJson({
          packageJson: {
            dependencies: {
              '@netlify/blobs': '^6.3.0',
              '@netlify/functions': '^2.4.0',
            },
          },
        })
        .withContentFile({
          path: 'functions/read-blob.ts',
          content: `
  import { getDeployStore } from "@netlify/blobs"
  import { Config } from "@netlify/functions"

  export default async () => {
    const store = getDeployStore()
    const blob = await store.get('hello')

    return new Response(blob)
  }

  export const config: Config = {
    path: "/read-blob"
  }
          `,
        })
        .build()

      await execa.command('npm install', { cwd: builder.directory })
      const { deploy_url: deployUrl } = (await callCli(
        ['deploy', '--json', '--no-build'],
        {
          cwd: builder.directory,
          env: { NETLIFY_SITE_ID: context.siteId },
        },
        true,
      )) as unknown as { deploy_url: string }

      const response = await fetch(`${deployUrl}/read-blob`).then((res) => res.text())
      t.expect(response).toEqual('hello from the blob')
    })
  })

  setupFixtureTests('next-app-without-config', () => {
    test<FixtureTestContext>(
      'build without error without any netlify specific configuration',
      {
        timeout: 300_000,
      },
      async ({ fixture }) => {
        const { deploy_url: deployUrl } = (await callCli(
          ['deploy', '--json'],
          {
            cwd: fixture.directory,
            env: { NETLIFY_SITE_ID: context.siteId },
          },
          true,
        )) as unknown as { deploy_url: string }

        const html = await fetch(deployUrl).then((res) => res.text())
        const $ = load(html)

        expect($('title').text()).toEqual('Create Next App')
        expect($('img[alt="Next.js Logo"]').attr('src')).toBe('/next.svg')
      },
    )
  })

  test('should not run deploy with conflicting flags', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()
      try {
        await callCli(['deploy', '--no-build', '--prod-if-unlocked', '--prod'], {
          cwd: builder.directory,
          env: { NETLIFY_SITE_ID: context.siteId },
        })
      } catch (error) {
        expect(error).toHaveProperty(
          'stderr',
          expect.stringContaining(`Error: option '--prod-if-unlocked' cannot be used with option '-p, --prod'`),
        )
      }
    })
  })

  test('should deploy as draft when --draft flag is used', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const content = '<h1>Draft deploy test</h1>'
      builder.withContentFile({
        path: 'public/index.html',
        content,
      })

      await builder.build()

      const deploy = await callCli(['deploy', '--json', '--no-build', '--dir', 'public', '--draft'], {
        cwd: builder.directory,
        env: { NETLIFY_SITE_ID: context.siteId },
      }).then((output: string) => JSON.parse(output))

      await validateDeploy({ deploy, siteName: SITE_NAME, content })
      expect(deploy).toHaveProperty(
        'function_logs',
        `https://app.netlify.com/projects/${SITE_NAME}/logs/functions?scope=deploy:${deploy.deploy_id}`,
      )
      expect(deploy).toHaveProperty(
        'edge_function_logs',
        `https://app.netlify.com/projects/${SITE_NAME}/logs/edge-functions?scope=deployid:${deploy.deploy_id}`,
      )
    })
  })

  test('should not run deploy with --draft and --prod flags together', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()
      try {
        await callCli(['deploy', '--no-build', '--draft', '--prod'], {
          cwd: builder.directory,
          env: { NETLIFY_SITE_ID: context.siteId },
        })
      } catch (error) {
        expect(error).toHaveProperty(
          'stderr',
          expect.stringContaining(`Error: option '-p, --prod' cannot be used with option '--draft'`),
        )
      }
    })
  })

  test('should not run deploy with --draft and --prod-if-unlocked flags together', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()
      try {
        await callCli(['deploy', '--no-build', '--draft', '--prod-if-unlocked'], {
          cwd: builder.directory,
          env: { NETLIFY_SITE_ID: context.siteId },
        })
      } catch (error) {
        expect(error).toHaveProperty(
          'stderr',
          expect.stringContaining(`Error: option '--prod-if-unlocked' cannot be used with option '--draft'`),
        )
      }
    })
  })

  test('should deploy as draft when --draft flag is used with --alias and --no-build', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const content = '<h1>Draft deploy with alias test</h1>'
      builder.withContentFile({
        path: 'public/index.html',
        content,
      })

      await builder.build()

      const deploy = await callCli(
        ['deploy', '--json', '--no-build', '--dir', 'public', '--draft', '--alias', 'test-branch'],
        {
          cwd: builder.directory,
          env: { NETLIFY_SITE_ID: context.siteId },
        },
      ).then((output: string) => JSON.parse(output))

      await validateDeploy({ deploy, siteName: SITE_NAME, content })
      expect(deploy).toHaveProperty(
        'function_logs',
        `https://app.netlify.com/projects/${SITE_NAME}/logs/functions?scope=deploy:${deploy.deploy_id}`,
      )
      expect(deploy).toHaveProperty(
        'edge_function_logs',
        `https://app.netlify.com/projects/${SITE_NAME}/logs/edge-functions?scope=deployid:${deploy.deploy_id}`,
      )
      expect(deploy.deploy_url).toContain('test-branch--')
    })
  })

  test('should include source_zip_filename in JSON output when --upload-source-zip flag is used', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const content = '<h1>Source zip test</h1>'
      builder.withContentFile({
        path: 'public/index.html',
        content,
      })

      await builder.build()

      try {
        const deploy = await callCli(['deploy', '--json', '--no-build', '--dir', 'public', '--upload-source-zip'], {
          cwd: builder.directory,
          env: { NETLIFY_SITE_ID: context.siteId },
        }).then((output: string) => JSON.parse(output))

        await validateDeploy({ deploy, siteName: SITE_NAME, content })
        expect(deploy).toHaveProperty('source_zip_filename')
        expect(typeof deploy.source_zip_filename).toBe('string')
        expect(deploy.source_zip_filename).toMatch(/\.zip$/)
      } catch (error) {
        // If the feature is not yet supported by the API, skip the test
        if (
          error instanceof Error &&
          (error.message.includes('include_upload_url') || error.message.includes('source_zip'))
        ) {
          t.skip()
        } else {
          throw error
        }
      }
    })
  })

  test('should deploy files from the deploy config directory', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const deployConfig = {
        skew_protection: {
          patterns: ['.*'],
          sources: [
            {
              type: 'header',
              name: 'x-deploy-id',
            },
          ],
        },
      }
      builder
        .withContentFile({
          path: '.netlify/deploy-config/deploy-config.json',
          content: JSON.stringify(deployConfig),
        })
        .withContentFile({
          path: 'public/index.html',
          content: 'Static file',
        })
        .withFunction({
          config: { path: '/*' },
          path: 'echo-headers.mjs',
          pathPrefix: 'netlify/functions',
          handler: async (req: Request) =>
            Response.json({ 'x-deploy-id': req.headers.get('x-deploy-id'), 'x-foo': req.headers.get('x-foo') }),
          runtimeAPIVersion: 2,
        })
        .withNetlifyToml({
          config: {
            build: { publish: 'public', command: 'echo "no op"' },
          },
        })

      await builder.build()

      const options = {
        cwd: builder.directory,
        env: { NETLIFY_SITE_ID: context.siteId },
      }

      await callCli(['build'], options)
      const deploy = (await callCli(['deploy', '--json', '--no-build'], options).then((output: string) =>
        JSON.parse(output),
      )) as Deploy

      await pause(500)

      // Checking that `x-deploy-id` is null even though we're sending it in
      // the request asserts that skew protection (and therefore the deploy
      // config) is working.
      const expectedContent = { 'x-deploy-id': null, 'x-foo': 'bar' }

      await validateContent({
        siteUrl: deploy.deploy_url,
        path: '',
        content: JSON.stringify(expectedContent),
        headers: {
          'x-deploy-id': deploy.deploy_id,
          'x-foo': 'bar',
        },
      })
    })
  })
})
