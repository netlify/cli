import { isCI } from 'ci-info'
import execa from 'execa'
import { test } from 'vitest'

import cliPath from './utils/cli-path.cjs'
import { getExecaOptions, withDevServer } from './utils/dev-server.cjs'
import got from './utils/got.cjs'
import { DOWN, answerWithValue, handleQuestions } from './utils/handle-questions.cjs'
import { withSiteBuilder } from './utils/site-builder.cjs'
import { normalize } from './utils/snapshots.cjs'

const content = 'Hello World!'

// FIXME: Run test serial
// const test = isCI ? avaTest.serial.bind(avaTest) : avaTest
test('should default to process.cwd() and static server', async (t) => {
  await withSiteBuilder('site-with-index-file', async (builder) => {
    await builder
      .withContentFile({
        path: 'index.html',
        content,
      })
      .buildAsync()

    await withDevServer({ cwd: builder.directory }, async ({ output, url }) => {
      const response = await got(url).text()
      t.expect(response).toEqual(content)

      t.expect(normalize(output, { duration: true, filePath: true })).toMatchSnapshot()
    })
  })
})

test('should use static server when --dir flag is passed', async (t) => {
  await withSiteBuilder('site-with-index-file', async (builder) => {
    await builder
      .withContentFile({
        path: 'public/index.html',
        content,
      })
      .buildAsync()

    await withDevServer({ cwd: builder.directory, args: ['--dir', 'public'] }, async ({ output, url }) => {
      const response = await got(url).text()
      t.expect(response).toEqual(content)

      t.expect(normalize(output, { duration: true, filePath: true })).toMatchSnapshot()
    })
  })
})

test('should use static server when framework is set to #static', async (t) => {
  await withSiteBuilder('site-with-index-file', async (builder) => {
    await builder
      .withContentFile({
        path: 'index.html',
        content,
      })
      .withNetlifyToml({ config: { dev: { framework: '#static' } } })
      .buildAsync()

    await withDevServer({ cwd: builder.directory }, async ({ output, url }) => {
      const response = await got(url).text()
      t.expect(response).toEqual(content)

      t.expect(normalize(output, { duration: true, filePath: true })).toMatchSnapshot()
    })
  })
})

test('should log the command if using static server and `command` is configured', async (t) => {
  await withSiteBuilder('site-with-index-file', async (builder) => {
    await builder
      .withContentFile({
        path: 'public/index.html',
        content,
      })
      .buildAsync()

    await withDevServer(
      { cwd: builder.directory, args: ['--dir', 'public', '--command', 'npm run start'] },
      async ({ output, url }) => {
        const response = await got(url).text()
        t.expect(response).toEqual(content)

        t.expect(normalize(output, { duration: true, filePath: true })).toMatchSnapshot()
      },
    )
  })
})

test('should warn if using static server and `targetPort` is configured', async (t) => {
  await withSiteBuilder('site-with-index-file', async (builder) => {
    await builder
      .withContentFile({
        path: 'public/index.html',
        content,
      })
      .buildAsync()

    await withDevServer(
      { cwd: builder.directory, args: ['--dir', 'public', '--target-port', '3000'] },
      async ({ output, url }) => {
        const response = await got(url).text()
        t.expect(response).toEqual(content)

        t.expect(normalize(output, { duration: true, filePath: true })).toMatchSnapshot()
      },
    )
  })
})

test('should run `command` when both `command` and `targetPort` are configured', async (t) => {
  await withSiteBuilder('empty-site', async (builder) => {
    await builder.withNetlifyToml({ config: { build: { publish: 'public' } } }).buildAsync()

    // a failure is expected since we use `echo hello` instead of starting a server
    const error = await withDevServer(
      { cwd: builder.directory, args: ['--command', 'echo hello', '--target-port', '3000'] },
      () => {},
      true,
    ).catch((error_) => error_)
    t.expect(normalize(error.stdout, { duration: true, filePath: true })).toMatchSnapshot()
  })
})

test('should force a specific framework when configured', async (t) => {
  await withSiteBuilder('site-with-mocked-cra', async (builder) => {
    await builder.withNetlifyToml({ config: { dev: { framework: 'create-react-app' } } }).buildAsync()

    // a failure is expected since this is not a true create-react-app project
    const error = await withDevServer({ cwd: builder.directory }, () => {}, true).catch((error_) => error_)
    t.expect(normalize(error.stdout, { duration: true, filePath: true })).toMatchSnapshot()
  })
})

test('should throw when forcing a non supported framework', async (t) => {
  await withSiteBuilder('site-with-unknown-framework', async (builder) => {
    await builder.withNetlifyToml({ config: { dev: { framework: 'to-infinity-and-beyond-js' } } }).buildAsync()

    const error = await withDevServer({ cwd: builder.directory }, () => {}, true).catch((error_) => error_)
    t.expect(normalize(error.stdout, { duration: true, filePath: true })).toMatchSnapshot()
  })
})

test('should detect a known framework', async (t) => {
  await withSiteBuilder('site-with-cra', async (builder) => {
    await builder
      .withPackageJson({
        packageJson: { dependencies: { 'react-scripts': '1.0.0' }, scripts: { start: 'react-scripts start' } },
      })
      .buildAsync()

    // a failure is expected since this is not a true create-react-app project
    const error = await withDevServer({ cwd: builder.directory }, () => {}, true).catch((error_) => error_)
    t.expect(normalize(error.stdout, { duration: true, filePath: true })).toMatchSnapshot()
  })
})

test('should throw if framework=#custom but command is missing', async (t) => {
  await withSiteBuilder('site-with-framework-and-no-command', async (builder) => {
    await builder.withNetlifyToml({ config: { dev: { framework: '#custom' } } }).buildAsync()

    const error = await withDevServer(
      { cwd: builder.directory, args: ['--target-port', '3000'] },
      () => {},
      true,
    ).catch((error_) => error_)
    t.expect(normalize(error.stdout, { duration: true, filePath: true })).toMatchSnapshot()
  })
})

test('should throw if framework=#custom but targetPort is missing', async (t) => {
  await withSiteBuilder('site-with-framework-and-no-command', async (builder) => {
    await builder.withNetlifyToml({ config: { dev: { framework: '#custom' } } }).buildAsync()

    const error = await withDevServer(
      { cwd: builder.directory, args: ['--command', 'echo hello'] },
      () => {},
      true,
    ).catch((error_) => error_)
    t.expect(normalize(error.stdout, { duration: true, filePath: true })).toMatchSnapshot()
  })
})

test('should start custom command if framework=#custom, command and targetPort are configured', async (t) => {
  await withSiteBuilder('site-with-custom-framework', async (builder) => {
    await builder.withNetlifyToml({ config: { dev: { framework: '#custom', publish: 'public' } } }).buildAsync()

    const error = await withDevServer(
      { cwd: builder.directory, args: ['--command', 'echo hello', '--target-port', '3000'] },
      () => {},
      true,
    ).catch((error_) => error_)
    t.expect(normalize(error.stdout, { duration: true, filePath: true })).toMatchSnapshot()
  })
})

test(`should print specific error when command doesn't exist`, async (t) => {
  await withSiteBuilder('site-with-custom-framework', async (builder) => {
    await builder.buildAsync()

    const error = await withDevServer(
      {
        cwd: builder.directory,
        args: [
          '--command',
          'oops-i-did-it-again forgot-to-use-a-valid-command',
          '--target-port',
          '3000',
          '--framework',
          '#custom',
        ],
      },
      () => {},
      true,
    ).catch((error_) => error_)
    t.expect(normalize(error.stdout, { duration: true, filePath: true })).toMatchSnapshot()
  })
})

test('should prompt when multiple frameworks are detected', async (t) => {
  await withSiteBuilder('site-with-multiple-frameworks', async (builder) => {
    await builder
      .withPackageJson({
        packageJson: {
          dependencies: { 'react-scripts': '1.0.0', gatsby: '^3.0.0' },
          scripts: { start: 'react-scripts start', develop: 'gatsby develop' },
        },
      })
      .withContentFile({ path: 'gatsby-config.js', content: '' })
      .buildAsync()

    // a failure is expected since this is not a true framework project
    const asyncError = async () => {
      const childProcess = execa(cliPath, ['dev', '--offline'], getExecaOptions({ cwd: builder.directory }))

      handleQuestions(childProcess, [
        {
          question: 'Multiple possible start commands found',
          answer: answerWithValue(DOWN),
        },
      ])

      await childProcess
    }
    const error = await asyncError().catch((error_) => error_)
    t.expect(normalize(error.stdout, { duration: true, filePath: true })).toMatchSnapshot()
  })
})

test('should not run framework detection if command and targetPort are configured', async (t) => {
  await withSiteBuilder('site-with-hugo-config', async (builder) => {
    await builder.withContentFile({ path: 'config.toml', content: '' }).buildAsync()

    // a failure is expected since the command exits early
    const error = await withDevServer(
      { cwd: builder.directory, args: ['--command', 'echo hello', '--target-port', '3000'] },
      () => {},
      true,
    ).catch((error_) => error_)
    t.expect(normalize(error.stdout, { duration: true, filePath: true })).toMatchSnapshot()
  })
})

test('should filter frameworks with no dev command', async (t) => {
  await withSiteBuilder('site-with-gulp', async (builder) => {
    await builder
      .withContentFile({
        path: 'index.html',
        content,
      })
      .withPackageJson({
        packageJson: { dependencies: { gulp: '1.0.0' } },
      })
      .buildAsync()

    await withDevServer({ cwd: builder.directory }, async ({ output, url }) => {
      const response = await got(url).text()
      t.expect(response).toEqual(content)

      t.expect(normalize(output, { duration: true, filePath: true })).toMatchSnapshot()
    })
  })
})

test('should pass framework-info env to framework sub process', async (t) => {
  await withSiteBuilder('site-with-gatsby', async (builder) => {
    await builder
      .withPackageJson({
        packageJson: {
          dependencies: { nuxt3: '^2.0.0' },
          scripts: { dev: 'node -p process.env.NODE_VERSION' },
        },
      })
      .buildAsync()

    // a failure is expected since this is not a true Gatsby project
    const error = await withDevServer({ cwd: builder.directory }, () => {}, true).catch((error_) => error_)
    t.expect(normalize(error.stdout, { duration: true, filePath: true })).toMatchSnapshot()
  })
})

test('should start static service for frameworks without port, forced framework', async (t) => {
  await withSiteBuilder('site-with-remix', async (builder) => {
    await builder.withNetlifyToml({ config: { dev: { framework: 'remix' } } }).buildAsync()

    // a failure is expected since this is not a true remix project
    const error = await withDevServer({ cwd: builder.directory }, () => {}, true).catch((error_) => error_)
    t.expect(error.stdout.includes(`Failed running command: remix watch. Please verify 'remix' exists`)).toBe(true)
  })
})

test('should start static service for frameworks without port, detected framework', async (t) => {
  await withSiteBuilder('site-with-remix', async (builder) => {
    await builder
      .withPackageJson({
        packageJson: {
          dependencies: { remix: '^1.0.0', '@remix-run/netlify': '^1.0.0' },
          scripts: {},
        },
      })
      .withContentFile({ path: 'remix.config.js', content: '' })
      .buildAsync()

    // a failure is expected since this is not a true remix project
    const error = await withDevServer({ cwd: builder.directory }, () => {}, true).catch((error_) => error_)
    t.expect(error.stdout.includes(`Failed running command: remix watch. Please verify 'remix' exists`)).toBe(true)
  })
})

test('should run and serve a production build when using the `serve` command', async (t) => {
  await withSiteBuilder('site-with-framework', async (builder) => {
    await builder
      .withNetlifyToml({
        config: {
          build: { publish: 'public' },
          context: {
            dev: { environment: { CONTEXT_CHECK: 'DEV' } },
            production: { environment: { CONTEXT_CHECK: 'PRODUCTION' } },
          },
          functions: { directory: 'functions' },
          plugins: [{ package: './plugins/frameworker' }],
        },
      })
      .withBuildPlugin({
        name: 'frameworker',
        plugin: {
          onPreBuild: async ({ netlifyConfig }) => {
            // TODO:migrate site-builder.cjs (withBuildPlugin) to ESM so that we can
            // get rid of require and use ESM and dynamic import instead
            const { mkdir, writeFile } = require('fs/promises')

            const generatedFunctionsDir = 'new_functions'
            netlifyConfig.functions.directory = generatedFunctionsDir

            netlifyConfig.redirects.push({
              from: '/hello',
              to: '/.netlify/functions/hello',
            })

            await mkdir(generatedFunctionsDir)
            await writeFile(
              `${generatedFunctionsDir}/hello.js`,
              `const { CONTEXT_CHECK, NETLIFY_DEV } = process.env; exports.handler = async () => ({ statusCode: 200, body: JSON.stringify({ CONTEXT_CHECK, NETLIFY_DEV }) })`,
            )
          },
        },
      })
      .buildAsync()

    await withDevServer(
      { cwd: builder.directory, context: null, debug: true, serve: true },
      async ({ output, url }) => {
        const response = await got(`${url}/hello`).json()
        t.expect(response).toStrictEqual({ CONTEXT_CHECK: 'PRODUCTION' })

        t.expect(normalize(output, { duration: true, filePath: true })).toMatchSnapshot()
      },
    )
  })
})
