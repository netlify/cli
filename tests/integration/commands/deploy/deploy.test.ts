import path from 'path'
import { fileURLToPath } from 'url'

import { describe, expect, test } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions, type MockApi } from '../../utils/mock-api-vitest.js'
import { withSiteBuilder } from '../../utils/site-builder.js'
import { createDeployRoutes, startDeployMockApi, type DeployRouteState } from './deploy-api-routes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

type Deploy = {
  site_id: string
  site_name: string
  deploy_url: string
  deploy_id: string
  logs: string
  function_logs: string
  edge_function_logs: string
  url?: string
  source_zip_filename?: string
}

const parseDeploy = (output: string): Deploy => {
  try {
    return JSON.parse(output)
  } catch {
    throw new Error(`Failed to parse deploy output as JSON. Raw output:\n${output}`)
  }
}

const withMockDeploy = async (fn: (mockApi: MockApi, deployState: DeployRouteState) => Promise<void>) => {
  const { routes, ...deployState } = createDeployRoutes()
  const mockApi = await startDeployMockApi({ routes })
  try {
    await fn(mockApi, deployState)
  } finally {
    await mockApi.close()
  }
}

describe.concurrent('deploy command', () => {
  test('should deploy project when dir flag is passed', async (t) => {
    await withMockDeploy(async (mockApi, deployState) => {
      await withSiteBuilder(t, async (builder) => {
        const content = '<h1>⊂◉‿◉つ</h1>'
        builder.withContentFile({
          path: 'public/index.html',
          content,
        })

        await builder.build()

        const deploy = await callCli(
          ['deploy', '--json', '--no-build', '--dir', 'public'],
          getCLIOptions({ apiUrl: mockApi.apiUrl, builder }),
        ).then(parseDeploy)

        expect(deploy.site_id).toBe('site_id')
        expect(deploy.deploy_id).toBe('deploy_id')
        expect(deploy.deploy_url).toBeTruthy()

        const body = deployState.getDeployBody()
        expect(body).not.toBeNull()
        expect(Object.keys(body!.files!)).toContain('index.html')

        const uploaded = deployState.getUploadedFiles()
        expect(Object.keys(uploaded).length).toBeGreaterThan(0)
      })
    })
  })

  test('should deploy project by name', async (t) => {
    await withMockDeploy(async (mockApi, deployState) => {
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

        const deploy = await callCli(
          ['deploy', '--json', '--no-build', '--site', 'test-site'],
          getCLIOptions({ apiUrl: mockApi.apiUrl, builder, env: { NETLIFY_SITE_ID: '' } }),
        ).then(parseDeploy)

        expect(deploy.site_name).toBe('test-site')

        const body = deployState.getDeployBody()
        expect(Object.keys(body!.files!)).toContain('index.html')
      })
    })
  })

  test('should deploy project when publish directory set in netlify.toml', async (t) => {
    await withMockDeploy(async (mockApi, deployState) => {
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

        const deploy = await callCli(
          ['deploy', '--json', '--no-build'],
          getCLIOptions({ apiUrl: mockApi.apiUrl, builder }),
        ).then(parseDeploy)

        expect(deploy.site_id).toBe('site_id')

        const body = deployState.getDeployBody()
        expect(Object.keys(body!.files!)).toContain('index.html')
      })
    })
  })

  test('should deploy Edge Functions when directory exists after running a build', async (t) => {
    await withMockDeploy(async (mockApi, deployState) => {
      await withSiteBuilder(t, async (builder) => {
        builder
          .withContentFile({
            path: 'public/index.html',
            content: 'Edge Function works NOT',
          })
          .withNetlifyToml({
            config: {
              build: { publish: 'public', command: 'echo "no op"' },
            },
          })
          .withEdgeFunction({
            handler: async () => new Response('Edge Function works'),
            config: {
              path: '/*',
            },
            name: 'edge',
          })

        await builder.build()

        const options = getCLIOptions({ apiUrl: mockApi.apiUrl, builder })

        await callCli(['build'], options)
        const deploy = await callCli(['deploy', '--json', '--no-build'], options).then(parseDeploy)

        expect(deploy.site_id).toBe('site_id')

        const body = deployState.getDeployBody()
        expect(body).not.toBeNull()
        expect(Object.keys(body!.files!)).toContain('index.html')
      })
    })
  })

  test('should deploy Edge Functions when directory exists without running a build', async (t) => {
    await withMockDeploy(async (mockApi, deployState) => {
      await withSiteBuilder(t, async (builder) => {
        builder
          .withContentFile({
            path: 'public/index.html',
            content: 'Edge Function works NOT',
          })
          .withNetlifyToml({
            config: {
              build: { publish: 'public', command: 'echo "no op"' },
            },
          })
          .withEdgeFunction({
            handler: async () => new Response('Edge Function works'),
            config: {
              path: '/*',
            },
            name: 'edge',
          })

        await builder.build()

        const deploy = await callCli(
          ['deploy', '--json', '--no-build'],
          getCLIOptions({ apiUrl: mockApi.apiUrl, builder }),
        ).then(parseDeploy)

        expect(deploy.site_id).toBe('site_id')

        const body = deployState.getDeployBody()
        expect(body).not.toBeNull()
        expect(Object.keys(body!.files!)).toContain('index.html')
      })
    })
  })

  test('should deploy Edge Functions with custom cwd when directory exists after running a build', async (t) => {
    await withMockDeploy(async (mockApi, deployState) => {
      await withSiteBuilder(t, async (builder) => {
        const pathPrefix = 'app/cool'
        builder
          .withContentFile({
            path: 'app/cool/public/index.html',
            content: 'Edge Function works NOT',
          })
          .withNetlifyToml({
            config: {
              build: { publish: 'public', command: 'echo "no op"' },
            },
            pathPrefix,
          })
          .withEdgeFunction({
            handler: async () => new Response('Edge Function works'),
            name: 'edge',
            config: {
              path: '/*',
            },
            pathPrefix,
          })

        await builder.build()

        const options = getCLIOptions({ apiUrl: mockApi.apiUrl, builder })

        await callCli(['build', '--cwd', pathPrefix], options)
        const deploy = await callCli(['deploy', '--json', '--no-build', '--cwd', pathPrefix], options).then(parseDeploy)

        expect(deploy.site_id).toBe('site_id')

        const body = deployState.getDeployBody()
        expect(body).not.toBeNull()
        expect(Object.keys(body!.files!)).toContain('index.html')
      })
    })
  })

  test('should deploy Edge Functions with custom cwd when directory exists without running a build', async (t) => {
    await withMockDeploy(async (mockApi, deployState) => {
      await withSiteBuilder(t, async (builder) => {
        const pathPrefix = 'app/cool'
        builder
          .withContentFile({
            path: 'app/cool/public/index.html',
            content: 'Edge Function works NOT',
          })
          .withNetlifyToml({
            config: {
              build: { publish: 'public', command: 'echo "no op"' },
            },
            pathPrefix,
          })
          .withEdgeFunction({
            handler: async () => new Response('Edge Function works'),
            name: 'edge',
            config: {
              path: '/*',
            },
            pathPrefix,
          })

        await builder.build()

        const deploy = await callCli(
          ['deploy', '--json', '--no-build', '--cwd', pathPrefix],
          getCLIOptions({ apiUrl: mockApi.apiUrl, builder }),
        ).then(parseDeploy)

        expect(deploy.site_id).toBe('site_id')

        const body = deployState.getDeployBody()
        expect(body).not.toBeNull()
        expect(Object.keys(body!.files!)).toContain('index.html')
      })
    })
  })

  test('should deploy integrations Edge Functions when directory exists after running a build', async (t) => {
    await withMockDeploy(async (mockApi, deployState) => {
      await withSiteBuilder(t, async (builder) => {
        builder
          .withContentFile({
            path: 'public/index.html',
            content: 'Edge Function works NOT',
          })
          .withNetlifyToml({
            config: {
              build: { publish: 'public', command: 'echo "no op"' },
            },
          })
          .withEdgeFunction({
            handler: async () => new Response('Edge Function works'),
            config: {
              path: '/*',
            },
            name: 'edge',
            path: '.netlify/edge-functions',
          })

        await builder.build()

        const options = getCLIOptions({ apiUrl: mockApi.apiUrl, builder })

        await callCli(['build'], options)
        const deploy = await callCli(['deploy', '--json', '--no-build'], options).then(parseDeploy)

        expect(deploy.site_id).toBe('site_id')

        const body = deployState.getDeployBody()
        expect(body).not.toBeNull()
        expect(Object.keys(body!.files!)).toContain('index.html')
      })
    })
  })

  test('should deploy integrations Edge Functions when directory exists without running a build', async (t) => {
    await withMockDeploy(async (mockApi, deployState) => {
      await withSiteBuilder(t, async (builder) => {
        builder
          .withContentFile({
            path: 'public/index.html',
            content: 'Edge Function works NOT',
          })
          .withNetlifyToml({
            config: {
              build: { publish: 'public', command: 'echo "no op"' },
            },
          })
          .withEdgeFunction({
            handler: async () => new Response('Edge Function works'),
            config: {
              path: '/*',
            },
            name: 'edge',
            path: '.netlify/edge-functions',
          })

        await builder.build()

        const deploy = await callCli(
          ['deploy', '--json', '--no-build'],
          getCLIOptions({ apiUrl: mockApi.apiUrl, builder }),
        ).then(parseDeploy)

        expect(deploy.site_id).toBe('site_id')

        const body = deployState.getDeployBody()
        expect(body).not.toBeNull()
        expect(Object.keys(body!.files!)).toContain('index.html')
      })
    })
  })

  test('should deploy framework Edge Functions when directory exists without running a build', async (t) => {
    await withMockDeploy(async (mockApi, deployState) => {
      await withSiteBuilder(t, async (builder) => {
        builder
          .withContentFile({
            path: 'public/index.html',
            content: 'Edge Function works NOT',
          })
          .withNetlifyToml({
            config: {
              build: { publish: 'public', command: 'echo "no op"' },
            },
          })
          .withEdgeFunction({
            handler: async () => new Response('Edge Function works'),
            config: {
              path: '/*',
            },
            name: 'edge',
            path: '.netlify/v1/edge-functions',
          })

        await builder.build()

        const deploy = await callCli(
          ['deploy', '--json', '--no-build'],
          getCLIOptions({ apiUrl: mockApi.apiUrl, builder }),
        ).then(parseDeploy)

        expect(deploy.site_id).toBe('site_id')

        const body = deployState.getDeployBody()
        expect(body).not.toBeNull()
        expect(Object.keys(body!.files!)).toContain('index.html')
      })
    })
  })

  test('runs build command before deploy by default', async (t) => {
    await withMockDeploy(async (mockApi, deployState) => {
      await withSiteBuilder(t, async (builder) => {
        const rootContent = '<h1>⊂◉‿◉つ</h1>'

        builder
          .withContentFile({
            path: 'public/index.html',
            content: rootContent,
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
              async onPreBuild() {
                const { DEPLOY_ID, DEPLOY_URL, NETLIFY_SKEW_PROTECTION_TOKEN } = require('process').env
                console.log(`DEPLOY_ID_PREBUILD: ${DEPLOY_ID}`)
                console.log(`DEPLOY_URL_PREBUILD: ${DEPLOY_URL}`)
                console.log(`NETLIFY_SKEW_PROTECTION_TOKEN_PREBUILD: ${NETLIFY_SKEW_PROTECTION_TOKEN}`)
              },
              async onSuccess() {
                const { DEPLOY_ID, DEPLOY_URL, NETLIFY_SKEW_PROTECTION_TOKEN } = require('process').env
                console.log(`DEPLOY_ID: ${DEPLOY_ID}`)
                console.log(`DEPLOY_URL: ${DEPLOY_URL}`)
                console.log(`NETLIFY_SKEW_PROTECTION_TOKEN: ${NETLIFY_SKEW_PROTECTION_TOKEN}`)
              },
            },
          })

        await builder.build()

        const output: string = await callCli(['deploy'], getCLIOptions({ apiUrl: mockApi.apiUrl, builder }))

        t.expect(output).toContain('Netlify Build completed in')
        const [, deployIdPreBuild] = output.match(/DEPLOY_ID_PREBUILD: (\w+)/) ?? []
        const [, deployURLPreBuild] = output.match(/DEPLOY_URL_PREBUILD: (.+)/) ?? []
        const [, skewProtectionTokenPreBuild] = output.match(/NETLIFY_SKEW_PROTECTION_TOKEN_PREBUILD: (.+)/) ?? []
        const [, deployId] = output.match(/DEPLOY_ID: (\w+)/) ?? []
        const [, deployURL] = output.match(/DEPLOY_URL: (.+)/) ?? []
        const [, skewProtectionToken] = output.match(/NETLIFY_SKEW_PROTECTION_TOKEN: (.+)/) ?? []

        t.expect(deployIdPreBuild).toBeTruthy()
        t.expect(deployIdPreBuild).toEqual('deploy_id')
        t.expect(deployURLPreBuild).toContain('https://deploy_id--')
        t.expect(deployId).toEqual(deployIdPreBuild)
        t.expect(deployURL).toEqual(deployURLPreBuild)

        t.expect(skewProtectionTokenPreBuild).toEqual(skewProtectionToken)
        t.expect(skewProtectionToken).toBeTruthy()

        const body = deployState.getDeployBody()
        expect(body).not.toBeNull()
        expect(Object.keys(body!.files!)).toContain('index.html')
      })
    })
  })

  test('warns and proceeds if extraneous `--build` is explicitly passed', async (t) => {
    await withMockDeploy(async (mockApi) => {
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

        const output: string = await callCli(['deploy', '--build'], getCLIOptions({ apiUrl: mockApi.apiUrl, builder }))

        t.expect(output).toMatch(/--build.+is now the default and can safely be omitted./)

        t.expect(output).toContain('Netlify Build completed in')
        const [, deployId] = output.match(/DEPLOY_ID: (\w+)/) ?? []
        const [, deployURL] = output.match(/DEPLOY_URL: (.+)/) ?? []

        t.expect(deployId).toEqual('deploy_id')
        t.expect(deployURL).toContain('https://deploy_id--')
      })
    })
  })

  test('should return valid json when --json is passed', async (t) => {
    await withMockDeploy(async (mockApi) => {
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

        const output: string = await callCli(['deploy', '--json'], getCLIOptions({ apiUrl: mockApi.apiUrl, builder }))

        expect(() => JSON.parse(output)).not.toThrowError()
      })
    })
  })

  test('does not run build command and build plugins before deploy when --no-build flag is passed', async (t) => {
    await withMockDeploy(async (mockApi) => {
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

        const output: string = await callCli(
          ['deploy', '--no-build'],
          getCLIOptions({ apiUrl: mockApi.apiUrl, builder }),
        )

        t.expect(output).not.toContain('Netlify Build completed in')
        t.expect(output).not.toContain('Hello from a build plugin')
      })
    })
  })

  test('should print deploy-scoped URLs for build logs, function logs, and edge function logs', async (t) => {
    await withMockDeploy(async (mockApi) => {
      await withSiteBuilder(t, async (builder) => {
        const content = '<h1>Why Next.js is perfect, an essay</h1>'
        builder.withContentFile({
          path: 'public/index.html',
          content,
        })
        await builder.build()

        const deploy = await callCli(
          ['deploy', '--json', '--no-build', '--dir', 'public'],
          getCLIOptions({ apiUrl: mockApi.apiUrl, builder }),
        ).then(parseDeploy)

        expect(deploy.site_id).toBe('site_id')
        expect(deploy.deploy_id).toBe('deploy_id')
        expect(deploy).toHaveProperty('logs', 'https://app.netlify.com/projects/test-site/deploys/deploy_id')
        expect(deploy).toHaveProperty(
          'function_logs',
          'https://app.netlify.com/projects/test-site/logs/functions?scope=deploy:deploy_id',
        )
        expect(deploy).toHaveProperty(
          'edge_function_logs',
          'https://app.netlify.com/projects/test-site/logs/edge-functions?scope=deployid:deploy_id',
        )
      })
    })
  })

  test('should print production URLs for build logs, function logs, and edge function logs when --prod is passed', async (t) => {
    await withMockDeploy(async (mockApi) => {
      await withSiteBuilder(t, async (builder) => {
        const content = '<h1>Why Next.js is perfect, a novella</h1>'
        builder.withContentFile({
          path: 'public/index.html',
          content,
        })
        await builder.build()

        const deploy = await callCli(
          ['deploy', '--json', '--no-build', '--dir', 'public', '--prod'],
          getCLIOptions({ apiUrl: mockApi.apiUrl, builder }),
        ).then(parseDeploy)

        expect(deploy.site_id).toBe('site_id')
        expect(deploy).toHaveProperty('logs', 'https://app.netlify.com/projects/test-site/deploys/deploy_id')
        expect(deploy).toHaveProperty('function_logs', 'https://app.netlify.com/projects/test-site/logs/functions')
        expect(deploy).toHaveProperty(
          'edge_function_logs',
          'https://app.netlify.com/projects/test-site/logs/edge-functions',
        )
      })
    })
  })

  test('should throw error when build fails with --json option', async (t) => {
    await withMockDeploy(async (mockApi) => {
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

        await expect(callCli(['deploy', '--json'], getCLIOptions({ apiUrl: mockApi.apiUrl, builder }))).rejects.toThrow(
          /Error while running build.*Build failed with custom error/,
        )
      })
    })
  })

  test('should throw error without stderr details when build fails with --json option and no stderr output', async (t) => {
    await withMockDeploy(async (mockApi) => {
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

        await expect(callCli(['deploy', '--json'], getCLIOptions({ apiUrl: mockApi.apiUrl, builder }))).rejects.toThrow(
          'Error while running build',
        )
      })
    })
  })

  test('should include stdout and stderr when build fails with --json --verbose options', async (t) => {
    await withMockDeploy(async (mockApi) => {
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
          callCli(['deploy', '--json', '--verbose'], getCLIOptions({ apiUrl: mockApi.apiUrl, builder })),
        ).rejects.toThrow('Build output')
      })
    })
  })

  test('should deploy hidden public folder but ignore hidden/__MACOSX files', async (t) => {
    await withMockDeploy(async (mockApi, deployState) => {
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

        const deploy = await callCli(
          ['deploy', '--json', '--no-build'],
          getCLIOptions({ apiUrl: mockApi.apiUrl, builder }),
        ).then(parseDeploy)

        expect(deploy.site_id).toBe('site_id')

        const body = deployState.getDeployBody()
        const fileKeys = Object.keys(body!.files!)

        expect(fileKeys).toContain('index.html')
        expect(fileKeys).not.toContain('.hidden-file.html')
        expect(fileKeys).not.toContain('.hidden-dir/index.html')
        expect(fileKeys).not.toContain('__MACOSX/index.html')
      })
    })
  })

  test('should filter node_modules from root directory', async (t) => {
    await withMockDeploy(async (mockApi, deployState) => {
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

        const deploy = await callCli(
          ['deploy', '--json', '--no-build'],
          getCLIOptions({ apiUrl: mockApi.apiUrl, builder }),
        ).then(parseDeploy)

        expect(deploy.site_id).toBe('site_id')

        const body = deployState.getDeployBody()
        const fileKeys = Object.keys(body!.files!)

        expect(fileKeys).toContain('index.html')
        expect(fileKeys).not.toContain('node_modules/package.json')
      })
    })
  })

  test('should not filter node_modules from publish directory', async (t) => {
    await withMockDeploy(async (mockApi, deployState) => {
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

        const deploy = await callCli(
          ['deploy', '--json', '--no-build'],
          getCLIOptions({ apiUrl: mockApi.apiUrl, builder }),
        ).then(parseDeploy)

        expect(deploy.site_id).toBe('site_id')

        const body = deployState.getDeployBody()
        const fileKeys = Object.keys(body!.files!)

        expect(fileKeys).toContain('index.html')
        expect(fileKeys).toContain('node_modules/package.json')
      })
    })
  })

  test('refreshes configuration when building before deployment', async (t) => {
    await withMockDeploy(async (mockApi, deployState) => {
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

        await callCli(['deploy', '--json'], getCLIOptions({ apiUrl: mockApi.apiUrl, builder })).then(parseDeploy)

        const body = deployState.getDeployBody()
        expect(body).not.toBeNull()
        expect(Object.keys(body!.functions || {})).toContain('hello')
      })
    })
  })

  test('should deploy functions from internal functions directory and Frameworks API', async (t) => {
    await withMockDeploy(async (mockApi, deployState) => {
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
          .build()

        await callCli(['deploy', '--json'], getCLIOptions({ apiUrl: mockApi.apiUrl, builder })).then(parseDeploy)

        const body = deployState.getDeployBody()
        expect(body).not.toBeNull()
        const fnNames = Object.keys(body!.functions || {})
        expect(fnNames).toContain('func-1')
        expect(fnNames).toContain('func-2')
        expect(fnNames).toContain('func-3')
        expect(fnNames).toContain('framework-1')
      })
    })
  })

  test('should deploy functions from internal functions directory when setting `base` to a sub-directory', async (t) => {
    await withMockDeploy(async (mockApi, deployState) => {
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

        await callCli(['deploy', '--json'], getCLIOptions({ apiUrl: mockApi.apiUrl, builder })).then(parseDeploy)

        const body = deployState.getDeployBody()
        expect(body).not.toBeNull()
        expect(Object.keys(body!.functions || {})).toContain('func-1')
      })
    })
  })

  test('should handle redirects mutated by plugins', async (t) => {
    await withMockDeploy(async (mockApi, deployState) => {
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

        await callCli(['deploy', '--json'], getCLIOptions({ apiUrl: mockApi.apiUrl, builder })).then(parseDeploy)

        const body = deployState.getDeployBody()
        expect(body).not.toBeNull()
        expect(Object.keys(body!.files!)).toContain('index.html')
        expect(Object.keys(body!.functions || {})).toContain('hello')
      })
    })
  })

  test('should deploy pre-bundled functions when a valid manifest file is found', async (t) => {
    await withMockDeploy(async (mockApi, deployState) => {
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

        await callCli(['deploy', '--json', '--no-build'], getCLIOptions({ apiUrl: mockApi.apiUrl, builder })).then(
          parseDeploy,
        )

        const body = deployState.getDeployBody()
        expect(body).not.toBeNull()
        expect(Object.keys(body!.functions || {})).toContain('bundled-function-1')
      })
    })
  })

  test('should not deploy pre-bundled functions when the --skip-functions-cache flag is used', async (t) => {
    await withMockDeploy(async (mockApi, deployState) => {
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

        await callCli(
          ['deploy', '--json', '--no-build', '--skip-functions-cache'],
          getCLIOptions({ apiUrl: mockApi.apiUrl, builder }),
        ).then(parseDeploy)

        const body = deployState.getDeployBody()
        expect(body).not.toBeNull()
        expect(Object.keys(body!.functions || {})).toContain('bundled-function-1')
      })
    })
  })

  test('should not deploy pre-bundled functions when the manifest file is older than the configured TTL', async (t) => {
    await withMockDeploy(async (mockApi, deployState) => {
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

        await callCli(['deploy', '--json', '--no-build'], getCLIOptions({ apiUrl: mockApi.apiUrl, builder })).then(
          parseDeploy,
        )

        const body = deployState.getDeployBody()
        expect(body).not.toBeNull()
        expect(Object.keys(body!.functions || {})).toContain('bundled-function-1')
      })
    })
  })

  test('should not run deploy with conflicting flags', async (t) => {
    await withMockDeploy(async (mockApi) => {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()
        await expect(
          callCli(
            ['deploy', '--no-build', '--prod-if-unlocked', '--prod'],
            getCLIOptions({ apiUrl: mockApi.apiUrl, builder }),
          ),
        ).rejects.toHaveProperty(
          'stderr',
          expect.stringContaining(`Error: option '--prod-if-unlocked' cannot be used with option '-p, --prod'`),
        )
      })
    })
  })

  test('should deploy as draft when --draft flag is used', async (t) => {
    await withMockDeploy(async (mockApi) => {
      await withSiteBuilder(t, async (builder) => {
        const content = '<h1>Draft deploy test</h1>'
        builder.withContentFile({
          path: 'public/index.html',
          content,
        })

        await builder.build()

        const deploy = await callCli(
          ['deploy', '--json', '--no-build', '--dir', 'public', '--draft'],
          getCLIOptions({ apiUrl: mockApi.apiUrl, builder }),
        ).then(parseDeploy)

        expect(deploy.site_id).toBe('site_id')
        expect(deploy.deploy_id).toBe('deploy_id')
        expect(deploy).toHaveProperty(
          'function_logs',
          'https://app.netlify.com/projects/test-site/logs/functions?scope=deploy:deploy_id',
        )
        expect(deploy).toHaveProperty(
          'edge_function_logs',
          'https://app.netlify.com/projects/test-site/logs/edge-functions?scope=deployid:deploy_id',
        )
      })
    })
  })

  test('should not run deploy with --draft and --prod flags together', async (t) => {
    await withMockDeploy(async (mockApi) => {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()
        await expect(
          callCli(['deploy', '--no-build', '--draft', '--prod'], getCLIOptions({ apiUrl: mockApi.apiUrl, builder })),
        ).rejects.toHaveProperty(
          'stderr',
          expect.stringContaining(`Error: option '-p, --prod' cannot be used with option '--draft'`),
        )
      })
    })
  })

  test('should not run deploy with --draft and --prod-if-unlocked flags together', async (t) => {
    await withMockDeploy(async (mockApi) => {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()
        await expect(
          callCli(
            ['deploy', '--no-build', '--draft', '--prod-if-unlocked'],
            getCLIOptions({ apiUrl: mockApi.apiUrl, builder }),
          ),
        ).rejects.toHaveProperty(
          'stderr',
          expect.stringContaining(`Error: option '--prod-if-unlocked' cannot be used with option '--draft'`),
        )
      })
    })
  })

  test('should deploy as draft when --draft flag is used with --alias and --no-build', async (t) => {
    await withMockDeploy(async (mockApi) => {
      await withSiteBuilder(t, async (builder) => {
        const content = '<h1>Draft deploy with alias test</h1>'
        builder.withContentFile({
          path: 'public/index.html',
          content,
        })

        await builder.build()

        const deploy = await callCli(
          ['deploy', '--json', '--no-build', '--dir', 'public', '--draft', '--alias', 'test-branch'],
          getCLIOptions({ apiUrl: mockApi.apiUrl, builder }),
        ).then(parseDeploy)

        expect(deploy.site_id).toBe('site_id')
        expect(deploy).toHaveProperty(
          'function_logs',
          'https://app.netlify.com/projects/test-site/logs/functions?scope=deploy:deploy_id',
        )
        expect(deploy).toHaveProperty(
          'edge_function_logs',
          'https://app.netlify.com/projects/test-site/logs/edge-functions?scope=deployid:deploy_id',
        )
      })
    })
  })
})
