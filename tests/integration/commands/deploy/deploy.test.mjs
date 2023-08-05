import path from 'path'
import process from 'process'

import test from 'ava'
import { Response } from 'node-fetch'

import callCli from '../../utils/call-cli.cjs'
import { createLiveTestSite, generateSiteName } from '../../utils/create-live-test-site.cjs'
import got from '../../utils/got.cjs'
import { withSiteBuilder } from '../../utils/site-builder.cjs'
import { fileURLToPath } from 'url'

// eslint-disable-next-line no-underscore-dangle
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SITE_NAME = generateSiteName('netlify-test-deploy-')

const validateContent = async ({ content, path, siteUrl, t }) => {
  try {
    const { body } = await got(`${siteUrl}${path}`)
    t.is(body, content)
  } catch (error) {
    const {
      response: { body, statusCode, statusMessage },
    } = error
    if (content === undefined) {
      t.is(statusCode, 404)
      return
    }
    throw new Error(`Failed getting content: ${statusCode} - ${statusMessage} - ${body}`)
  }
}

const validateDeploy = async ({ content, contentMessage, deploy, siteName, t }) => {
  t.truthy(deploy.site_name)
  t.truthy(deploy.deploy_url)
  t.truthy(deploy.deploy_id)
  t.truthy(deploy.logs)
  t.is(deploy.site_name, siteName, contentMessage)

  await validateContent({ siteUrl: deploy.deploy_url, path: '', content, t })
}

if (process.env.NETLIFY_TEST_DISABLE_LIVE !== 'true') {
  test.before(async (t) => {
    const { account, siteId } = await createLiveTestSite(SITE_NAME)
    t.context.siteId = siteId
    t.context.account = account
  })

  test.serial('should deploy site when dir flag is passed', async (t) => {
    await withSiteBuilder('site-with-public-folder', async (builder) => {
      const content = '<h1>⊂◉‿◉つ</h1>'
      builder.withContentFile({
        path: 'public/index.html',
        content,
      })

      await builder.buildAsync()

      const deploy = await callCli(['deploy', '--json', '--dir', 'public'], {
        cwd: builder.directory,
        env: { NETLIFY_SITE_ID: t.context.siteId },
      }).then((output) => JSON.parse(output))

      await validateDeploy({ deploy, siteName: SITE_NAME, content, t })
    })
  })

  test.serial('should deploy site by name', async (t) => {
    await withSiteBuilder('site-with-public-folder', async (builder) => {
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

      await builder.buildAsync()

      const deploy = await callCli(['deploy', '--json', '--site', SITE_NAME], {
        cwd: builder.directory,
      }).then((output) => JSON.parse(output))

      await validateDeploy({ deploy, siteName: SITE_NAME, content, t })
    })
  })

  test.serial('should deploy site when publish directory set in netlify.toml', async (t) => {
    await withSiteBuilder('site-with-public-folder', async (builder) => {
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

      await builder.buildAsync()

      const deploy = await callCli(['deploy', '--json'], {
        cwd: builder.directory,
        env: { NETLIFY_SITE_ID: t.context.siteId },
      }).then((output) => JSON.parse(output))

      await validateDeploy({ deploy, siteName: SITE_NAME, content, t })
    })
  })

  test.serial('should deploy Edge Functions when directory exists', async (t) => {
    await withSiteBuilder('site-with-public-folder', async (builder) => {
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

      await builder.buildAsync()

      const options = {
        cwd: builder.directory,
        env: { NETLIFY_SITE_ID: t.context.siteId },
      }

      await callCli(['build'], options)
      const deploy = await callCli(['deploy', '--json'], options).then((output) => JSON.parse(output))

      await validateDeploy({
        deploy,
        siteName: SITE_NAME,
        content: 'Edge Function works',
        contentMessage: 'Edge function did not execute correctly or was not deployed correctly',
        t,
      })
    })
  })

  test.serial('should deploy Edge Functions with custom cwd when directory exists', async (t) => {
    await withSiteBuilder('site-with-public-folder', async (builder) => {
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

      await builder.buildAsync()

      const options = {
        cwd: builder.directory,
        env: { NETLIFY_SITE_ID: t.context.siteId },
      }

      await callCli(['build', '--cwd', pathPrefix], options)
      const deploy = await callCli(['deploy', '--json', '--cwd', pathPrefix], options).then((output) =>
        JSON.parse(output),
      )

      await validateDeploy({
        deploy,
        siteName: SITE_NAME,
        content: 'Edge Function works',
        contentMessage: 'Edge function did not execute correctly or was not deployed correctly',
        t,
      })
    })
  })

  test.serial('should run build command before deploy when build flag is passed', async (t) => {
    await withSiteBuilder('site-with-public-folder', async (builder) => {
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

      await builder.buildAsync()

      const output = await callCli(['deploy', '--build'], {
        cwd: builder.directory,
        env: { NETLIFY_SITE_ID: t.context.siteId },
      })

      t.is(output.includes('Netlify Build completed in'), true)
    })
  })

  test.serial('should return valid json when both --build and --json are passed', async (t) => {
    await withSiteBuilder('site-with-public-folder', async (builder) => {
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

      await builder.buildAsync()

      const output = await callCli(['deploy', '--build', '--json'], {
        cwd: builder.directory,
        env: { NETLIFY_SITE_ID: t.context.siteId },
      })

      JSON.parse(output)
    })
  })

  test.serial('should deploy hidden public folder but ignore hidden/__MACOSX files', async (t) => {
    await withSiteBuilder('site-with-a-dedicated-publish-folder', async (builder) => {
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

      await builder.buildAsync()

      const deploy = await callCli(['deploy', '--json'], {
        cwd: builder.directory,
        env: { NETLIFY_SITE_ID: t.context.siteId },
      }).then((output) => JSON.parse(output))

      await validateDeploy({ deploy, siteName: SITE_NAME, content: 'index', t })
      await validateContent({
        siteUrl: deploy.deploy_url,
        content: undefined,
        path: '/.hidden-file',
        t,
      })
      await validateContent({
        siteUrl: deploy.deploy_url,
        content: undefined,
        path: '/.hidden-dir',
        t,
      })
      await validateContent({
        siteUrl: deploy.deploy_url,
        content: undefined,
        path: '/__MACOSX',
        t,
      })
    })
  })

  test.serial('should filter node_modules from root directory', async (t) => {
    await withSiteBuilder('site-with-a-project-directory', async (builder) => {
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

      await builder.buildAsync()

      const deploy = await callCli(['deploy', '--json'], {
        cwd: builder.directory,
        env: { NETLIFY_SITE_ID: t.context.siteId },
      }).then((output) => JSON.parse(output))

      await validateDeploy({ deploy, siteName: SITE_NAME, content: 'index', t })
      await validateContent({
        siteUrl: deploy.deploy_url,
        content: undefined,
        path: '/node_modules/package.json',
        t,
      })
    })
  })

  test.serial('should not filter node_modules from publish directory', async (t) => {
    await withSiteBuilder('site-with-a-project-directory', async (builder) => {
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

      await builder.buildAsync()

      const deploy = await callCli(['deploy', '--json'], {
        cwd: builder.directory,
        env: { NETLIFY_SITE_ID: t.context.siteId },
      }).then((output) => JSON.parse(output))

      await validateDeploy({ deploy, siteName: SITE_NAME, content: 'index', t })
      await validateContent({
        siteUrl: deploy.deploy_url,
        content: '{}',
        path: '/node_modules/package.json',
        t,
      })
    })
  })

  test.serial('should exit with error when deploying an empty directory', async (t) => {
    await withSiteBuilder('site-with-an-empty-directory', async (builder) => {
      await builder.buildAsync()

      try {
        await callCli(['deploy', '--dir', '.'], {
          cwd: builder.directory,
          env: { NETLIFY_SITE_ID: t.context.siteId },
        })
      } catch (error) {
        t.is(error.stderr.includes('Error: No files or functions to deploy'), true)
      }
    })
  })

  test.serial('should refresh configuration when --build is passed', async (t) => {
    await withSiteBuilder('site-with-public-folder', async (builder) => {
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
              const { mkdir, writeFile } = await import('fs/promises')

              const generatedFunctionsDir = 'new_functions'
              netlifyConfig.functions.directory = generatedFunctionsDir

              await mkdir(generatedFunctionsDir)
              await writeFile(
                `${generatedFunctionsDir}/hello.js`,
                `exports.handler = async () => ({ statusCode: 200, body: 'Hello' })`,
              )
            },
          },
        })
        .buildAsync()

      const { deploy_url: deployUrl } = await callCli(
        ['deploy', '--build', '--json'],
        {
          cwd: builder.directory,
          env: { NETLIFY_SITE_ID: t.context.siteId },
        },
        true,
      )

      const { body, statusCode } = await got(`${deployUrl}/.netlify/functions/hello`)
      t.is(body, 'Hello')
      t.is(statusCode, 200)
    })
  })

  test.serial('should deploy functions from internal functions directory', async (t) => {
    await withSiteBuilder('site-with-internal-functions', async (builder) => {
      await builder
        .withNetlifyToml({
          config: {
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
        .withContentFile({
          content: `export default async () => new Response("Internal V2 API")`,
          path: '.netlify/functions-internal/func-4.mjs',
        })
        .buildAsync()

      const { deploy_url: deployUrl } = await callCli(
        ['deploy', '--build', '--json'],
        {
          cwd: builder.directory,
          env: { NETLIFY_SITE_ID: t.context.siteId },
        },
        true,
      )

      t.is(await got(`${deployUrl}/.netlify/functions/func-1`).text(), 'User 1')
      t.is(await got(`${deployUrl}/.netlify/functions/func-2`).text(), 'User 2')
      t.is(await got(`${deployUrl}/.netlify/functions/func-3`).text(), 'Internal 3')
      t.is(await got(`${deployUrl}/.netlify/functions/func-4`).text(), 'Internal V2 API')
    })
  })

  test.serial(
    'should deploy functions from internal functions directory when setting `base` to a sub-directory',
    async (t) => {
      await withSiteBuilder('site-with-internal-functions-sub-directory', async (builder) => {
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
          .buildAsync()

        const { deploy_url: deployUrl } = await callCli(
          ['deploy', '--build', '--json'],
          {
            cwd: builder.directory,
            env: { NETLIFY_SITE_ID: t.context.siteId },
          },
          true,
        )

        t.is(await got(`${deployUrl}/.netlify/functions/func-1`).text(), 'Internal')
      })
    },
  )

  test.serial('should handle redirects mutated by plugins', async (t) => {
    await withSiteBuilder('site-with-public-folder', async (builder) => {
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
        .buildAsync()

      const deploy = await callCli(
        ['deploy', '--json', '--build'],
        {
          cwd: builder.directory,
          env: { NETLIFY_SITE_ID: t.context.siteId },
        },
        true,
      )

      const fullDeploy = await callCli(
        ['api', 'getDeploy', '--data', JSON.stringify({ deploy_id: deploy.deploy_id })],
        {
          cwd: builder.directory,
          env: { NETLIFY_SITE_ID: t.context.siteId },
        },
        true,
      )

      const redirectsMessage = fullDeploy.summary.messages.find(({ title }) => title === '3 redirect rules processed')
      t.is(redirectsMessage.description, 'All redirect rules deployed without errors.')

      await validateDeploy({ deploy, siteName: SITE_NAME, content, t })

      // plugin redirect
      t.is(await got(`${deploy.deploy_url}/other-api/hello`).text(), 'hello')
      // _redirects redirect
      t.is(await got(`${deploy.deploy_url}/api/hello`).text(), 'hello')
      // netlify.toml redirect
      t.is(await got(`${deploy.deploy_url}/not-existing`).text(), content)
    })
  })

  test.serial('should deploy pre-bundled functions when a valid manifest file is found', async (t) => {
    const bundledFunctionPath = path.join(__dirname, '../../assets', 'bundled-function-1.zip')
    const bundledFunctionData = {
      mainFile: '/some/path/bundled-function-1.js',
      name: 'bundled-function-1',
      runtime: 'js',
    }

    await withSiteBuilder('site-with-functions-manifest-1', async (builder) => {
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
        .buildAsync()

      const { deploy_url: deployUrl } = await callCli(
        ['deploy', '--json'],
        {
          cwd: builder.directory,
          env: { NETLIFY_SITE_ID: t.context.siteId },
        },
        true,
      )

      t.is(await got(`${deployUrl}/.netlify/functions/bundled-function-1`).text(), 'Pre-bundled')
    })
  })

  test.serial('should not deploy pre-bundled functions when the --skip-functions-cache flag is used', async (t) => {
    const bundledFunctionPath = path.join(__dirname, '../../assets', 'bundled-function-1.zip')
    const bundledFunctionData = {
      mainFile: '/some/path/bundled-function-1.js',
      name: 'bundled-function-1',
      runtime: 'js',
    }

    await withSiteBuilder('site-with-functions-manifest-2', async (builder) => {
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
        .buildAsync()

      const { deploy_url: deployUrl } = await callCli(
        ['deploy', '--json', '--skip-functions-cache'],
        {
          cwd: builder.directory,
          env: { NETLIFY_SITE_ID: t.context.siteId },
        },
        true,
      )

      t.is(await got(`${deployUrl}/.netlify/functions/bundled-function-1`).text(), 'Bundled at deployment')
    })
  })

  test.serial(
    'should not deploy pre-bundled functions when the manifest file is older than the configured TTL',
    async (t) => {
      const age = 18e4
      const bundledFunctionPath = path.join(__dirname, '../../assets', 'bundled-function-1.zip')
      const bundledFunctionData = {
        mainFile: '/some/path/bundled-function-1.js',
        name: 'bundled-function-1',
        runtime: 'js',
      }

      await withSiteBuilder('site-with-functions-manifest-3', async (builder) => {
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
          .buildAsync()

        const { deploy_url: deployUrl } = await callCli(
          ['deploy', '--json'],
          {
            cwd: builder.directory,
            env: { NETLIFY_SITE_ID: t.context.siteId },
          },
          true,
        )

        t.is(await got(`${deployUrl}/.netlify/functions/bundled-function-1`).text(), 'Bundled at deployment')
      })
    },
  )

  test.after('cleanup', async (t) => {
    const { siteId } = t.context
    console.log(`deleting test site "${SITE_NAME}". ${siteId}`)
    await callCli(['sites:delete', siteId, '--force'])
  })
}

test('always pass, used for forked PRs since ava fails when no tests are present', (t) => {
  t.pass()
})
