const test = require('ava')
const execa = require('execa')

const cliPath = require('./utils/cli-path')
const { withDevServer, getExecaOptions } = require('./utils/dev-server')
const got = require('./utils/got')
const { handleQuestions, CONFIRM, DOWN } = require('./utils/handle-questions')
const { withSiteBuilder } = require('./utils/site-builder')
const { normalize } = require('./utils/snapshots')

const content = 'Hello World!'

test('should default to process.cwd() and static server', async (t) => {
  await withSiteBuilder('site-with-index-file', async (builder) => {
    await builder
      .withContentFile({
        path: 'index.html',
        content,
      })
      .buildAsync()

    await withDevServer({ cwd: builder.directory }, async ({ url, output }) => {
      const response = await got(url).text()
      t.is(response, content)

      t.snapshot(normalize(output))
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

    await withDevServer({ cwd: builder.directory, args: ['--dir', 'public'] }, async ({ url, output }) => {
      const response = await got(url).text()
      t.is(response, content)

      t.snapshot(normalize(output))
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

    await withDevServer({ cwd: builder.directory }, async ({ url, output }) => {
      const response = await got(url).text()
      t.is(response, content)

      t.snapshot(normalize(output))
    })
  })
})

test('should warn if using static server and `command` is configured', async (t) => {
  await withSiteBuilder('site-with-index-file', async (builder) => {
    await builder
      .withContentFile({
        path: 'public/index.html',
        content,
      })
      .buildAsync()

    await withDevServer(
      { cwd: builder.directory, args: ['--dir', 'public', '--command', 'npm run start'] },
      async ({ url, output }) => {
        const response = await got(url).text()
        t.is(response, content)

        t.snapshot(normalize(output))
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
      { cwd: builder.directory, args: ['--dir', 'public', '--targetPort', '3000'] },
      async ({ url, output }) => {
        const response = await got(url).text()
        t.is(response, content)

        t.snapshot(normalize(output))
      },
    )
  })
})

test('should run `command` when both `command` and `targetPort` are configured', async (t) => {
  await withSiteBuilder('empty-site', async (builder) => {
    await builder.withNetlifyToml({ config: { build: { publish: 'public' } } }).buildAsync()

    // a failure is expected since we use `echo hello` instead of starting a server
    const error = await t.throwsAsync(() =>
      withDevServer(
        { cwd: builder.directory, args: ['--command', 'echo hello', '--targetPort', '3000'] },
        () => {},
        true,
      ),
    )
    t.snapshot(normalize(error.stdout))
  })
})

test('should force a specific framework when configured', async (t) => {
  await withSiteBuilder('site-with-mocked-cra', async (builder) => {
    await builder.withNetlifyToml({ config: { dev: { framework: 'create-react-app' } } }).buildAsync()

    // a failure is expected since this is not a true create-react-app project
    const error = await t.throwsAsync(() => withDevServer({ cwd: builder.directory }, () => {}, true))
    t.snapshot(normalize(error.stdout))
  })
})

test('should throw when forcing a non supported framework', async (t) => {
  await withSiteBuilder('site-with-unknown-framework', async (builder) => {
    await builder.withNetlifyToml({ config: { dev: { framework: 'to-infinity-and-beyond-js' } } }).buildAsync()

    const error = await t.throwsAsync(() => withDevServer({ cwd: builder.directory }, () => {}, true))
    t.snapshot(normalize(error.stdout))
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
    const error = await t.throwsAsync(() => withDevServer({ cwd: builder.directory }, () => {}, true))
    t.snapshot(normalize(error.stdout))
  })
})

test('should throw if framework=#custom but command is missing', async (t) => {
  await withSiteBuilder('site-with-framework-and-no-command', async (builder) => {
    await builder.withNetlifyToml({ config: { dev: { framework: '#custom' } } }).buildAsync()

    const error = await t.throwsAsync(() =>
      withDevServer({ cwd: builder.directory, args: ['--targetPort', '3000'] }, () => {}, true),
    )
    t.snapshot(normalize(error.stdout))
  })
})

test('should throw if framework=#custom but targetPort is missing', async (t) => {
  await withSiteBuilder('site-with-framework-and-no-command', async (builder) => {
    await builder.withNetlifyToml({ config: { dev: { framework: '#custom' } } }).buildAsync()

    const error = await t.throwsAsync(() =>
      withDevServer({ cwd: builder.directory, args: ['--command', 'echo hello'] }, () => {}, true),
    )
    t.snapshot(normalize(error.stdout))
  })
})

test('should start custom command if framework=#custom, command and targetPort are configured', async (t) => {
  await withSiteBuilder('site-with-custom-framework', async (builder) => {
    await builder.withNetlifyToml({ config: { dev: { framework: '#custom', publish: 'public' } } }).buildAsync()

    const error = await t.throwsAsync(() =>
      withDevServer(
        { cwd: builder.directory, args: ['--command', 'echo hello', '--targetPort', '3000'] },
        () => {},
        true,
      ),
    )
    t.snapshot(normalize(error.stdout))
  })
})

test(`should print specific error when command doesn't exist`, async (t) => {
  await withSiteBuilder('site-with-custom-framework', async (builder) => {
    await builder.buildAsync()

    const error = await t.throwsAsync(() =>
      withDevServer(
        {
          cwd: builder.directory,
          args: [
            '--command',
            'oops-i-did-it-again forgot-to-use-a-valid-command',
            '--targetPort',
            '3000',
            '--framework',
            '#custom',
          ],
        },
        () => {},
        true,
      ),
    )
    t.snapshot(normalize(error.stdout))
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
    const error = await t.throwsAsync(async () => {
      const childProcess = execa(cliPath, ['dev', '--offline'], getExecaOptions({ cwd: builder.directory }))

      handleQuestions(childProcess, [
        {
          question: 'Multiple possible start commands found',
          answer: `${DOWN}${CONFIRM}`,
        },
      ])

      await childProcess
    })
    t.snapshot(normalize(error.stdout))
  })
})

test('should not run framework detection if command and targetPort are configured', async (t) => {
  await withSiteBuilder('site-with-hugo-config', async (builder) => {
    await builder.withContentFile({ path: 'config.toml', content: '' }).buildAsync()

    // a failure is expected since the command exits early
    const error = await t.throwsAsync(() =>
      withDevServer(
        { cwd: builder.directory, args: ['--command', 'echo hello', '--targetPort', '3000'] },
        () => {},
        true,
      ),
    )
    t.snapshot(normalize(error.stdout))
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

    await withDevServer({ cwd: builder.directory }, async ({ url, output }) => {
      const response = await got(url).text()
      t.is(response, content)

      t.snapshot(normalize(output))
    })
  })
})
