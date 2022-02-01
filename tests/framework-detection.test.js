const execa = require('execa')
const stripAnsi = require('strip-ansi')

const cliPath = require('./utils/cli-path')
const { getExecaOptions, withDevServer } = require('./utils/dev-server')
const got = require('./utils/got')
const { CONFIRM, DOWN, handleQuestions } = require('./utils/handle-questions')
const { withSiteBuilder } = require('./utils/site-builder')
const { normalize } = require('./utils/snapshots')

const content = 'Hello World!'

beforeEach(() => {
  // disable noisy server startup logs
  jest.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => [jest.clearAllMocks()])

test('should default to process.cwd() and static server', async () => {
  await withSiteBuilder('site-with-index-file', async (builder) => {
    await builder
      .withContentFile({
        path: 'index.html',
        content,
      })
      .buildAsync()

    await withDevServer({ cwd: builder.directory }, async ({ output, url }) => {
      const response = await got(url).text()
      expect(response).toBe(content)

      expect(normalize(output)).toMatchSnapshot()
    })
  })
})

test('should use static server when --dir flag is passed', async () => {
  await withSiteBuilder('site-with-index-file', async (builder) => {
    await builder
      .withContentFile({
        path: 'public/index.html',
        content,
      })
      .buildAsync()

    await withDevServer({ cwd: builder.directory, args: ['--dir', 'public'] }, async ({ output, url }) => {
      const response = await got(url).text()
      expect(response).toBe(content)

      expect(normalize(output)).toMatchSnapshot()
    })
  })
})

test('should use static server when framework is set to #static', async () => {
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
      expect(response).toBe(content)

      expect(normalize(output)).toMatchSnapshot()
    })
  })
})

test('should log the command if using static server and `command` is configured', async () => {
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
        expect(response).toBe(content)

        expect(normalize(output)).toMatchSnapshot()
      },
    )
  })
})

test('should warn if using static server and `targetPort` is configured', async () => {
  await withSiteBuilder('site-with-index-file', async (builder) => {
    await builder
      .withContentFile({
        path: 'public/index.html',
        content,
      })
      .buildAsync()

    await withDevServer(
      { cwd: builder.directory, args: ['--dir', 'public', '--targetPort', '3000'] },
      async ({ output, url }) => {
        const response = await got(url).text()
        expect(response).toBe(content)

        expect(normalize(output)).toMatchSnapshot()
      },
    )
  })
})

test('should run `command` when both `command` and `targetPort` are configured', async () => {
  await withSiteBuilder('empty-site', async (builder) => {
    await builder.withNetlifyToml({ config: { build: { publish: 'public' } } }).buildAsync()

    // a failure is expected since we use `echo hello` instead of starting a server
    try {
      await withDevServer(
        { cwd: builder.directory, args: ['--command', 'echo hello', '--targetPort', '3000'] },
        () => {},
        true,
      )
    } catch (error) {
      expect(normalize(error.message)).toMatchSnapshot()
    }
  })
})

test('should force a specific framework when configured', async () => {
  await withSiteBuilder('site-with-mocked-cra', async (builder) => {
    await builder.withNetlifyToml({ config: { dev: { framework: 'create-react-app' } } }).buildAsync()

    // a failure is expected since this is not a true create-react-app project
    try {
      await withDevServer({ cwd: builder.directory }, () => {}, true)
    } catch (error) {
      expect(normalize(error.message)).toMatchSnapshot()
    }
  })
  expect.assertions(1)
})

test('should throw when forcing a non supported framework', async () => {
  await withSiteBuilder('site-with-unknown-framework', async (builder) => {
    await builder.withNetlifyToml({ config: { dev: { framework: 'to-infinity-and-beyond-js' } } }).buildAsync()

    try {
      await withDevServer({ cwd: builder.directory }, () => {}, true)
    } catch (error) {
      expect(normalize(error.message)).toMatchSnapshot()
    }
  })
  expect.assertions(1)
})

test('should detect a known framework', async () => {
  await withSiteBuilder('site-with-cra', async (builder) => {
    await builder
      .withPackageJson({
        packageJson: { dependencies: { 'react-scripts': '1.0.0' }, scripts: { start: 'react-scripts start' } },
      })
      .buildAsync()

    // a failure is expected since this is not a true create-react-app project
    try {
      await withDevServer({ cwd: builder.directory }, () => {}, true)
    } catch (error) {
      expect(normalize(error.message)).toMatchSnapshot()
    }
  })
  expect.assertions(1)
})

test('should throw if framework=#custom but command is missing', async () => {
  await withSiteBuilder('site-with-framework-and-no-command', async (builder) => {
    await builder.withNetlifyToml({ config: { dev: { framework: '#custom' } } }).buildAsync()

    try {
      await withDevServer({ cwd: builder.directory, args: ['--targetPort', '3000'] }, () => {}, true)
    } catch (error) {
      expect(normalize(error.message)).toMatchSnapshot()
    }
  })
  expect.assertions(1)
})

test('should throw if framework=#custom but targetPort is missing', async () => {
  await withSiteBuilder('site-with-framework-and-no-command', async (builder) => {
    await builder.withNetlifyToml({ config: { dev: { framework: '#custom' } } }).buildAsync()

    try {
      await withDevServer({ cwd: builder.directory, args: ['--command', 'echo hello'] }, () => {}, true)
    } catch (error) {
      expect(normalize(error.message)).toMatchSnapshot()
    }
  })
  expect.assertions(1)
})

test('should start custom command if framework=#custom, command and targetPort are configured', async () => {
  await withSiteBuilder('site-with-custom-framework', async (builder) => {
    await builder.withNetlifyToml({ config: { dev: { framework: '#custom', publish: 'public' } } }).buildAsync()

    try {
      await withDevServer(
        { cwd: builder.directory, args: ['--command', 'echo hello', '--targetPort', '3000'] },
        () => {},
        true,
      )
    } catch (error) {
      expect(normalize(error.message)).toMatchSnapshot()
    }
  })
  expect.assertions(1)
})

test(`should print specific error when command doesn't exist`, async () => {
  await withSiteBuilder('site-with-custom-framework', async (builder) => {
    await builder.buildAsync()

    try {
      await withDevServer(
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
      )
    } catch (error) {
      expect(normalize(error.message)).toMatchSnapshot()
    }
  })
  expect.assertions(1)
})

test('should prompt when multiple frameworks are detected', async () => {
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
    try {
      const childProcess = execa(cliPath, ['dev', '--offline'], getExecaOptions({ cwd: builder.directory }))

      handleQuestions(childProcess, [
        {
          question: 'Multiple possible start commands found',
          answer: `${DOWN}${CONFIRM}`,
        },
      ])

      await childProcess
    } catch (error) {
      expect(normalize(error.message)).toMatchSnapshot()
    }
  })
  expect.assertions(1)
})

test('should not run framework detection if command and targetPort are configured', async () => {
  await withSiteBuilder('site-with-hugo-config', async (builder) => {
    await builder.withContentFile({ path: 'config.toml', content: '' }).buildAsync()

    // a failure is expected since the command exits early
    try {
      await withDevServer(
        { cwd: builder.directory, args: ['--command', 'echo hello', '--targetPort', '3000'] },
        () => {},
        true,
      )
    } catch (error) {
      expect(normalize(error.message)).toMatchSnapshot()
    }
  })
  expect.assertions(1)
})

test('should filter frameworks with no dev command', async () => {
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
      expect(response).toBe(content)

      expect(normalize(output)).toMatchSnapshot()
    })
  })
})

test('should pass framework-info env to framework sub process', async () => {
  await withSiteBuilder('site-with-gatsby', async (builder) => {
    await builder
      .withPackageJson({
        packageJson: {
          dependencies: { gatsby: '^3.0.0' },
          scripts: { develop: 'node -p process.env.GATSBY_LOGGER' },
        },
      })
      .withContentFile({ path: 'gatsby-config.js', content: '' })
      .buildAsync()

    // a failure is expected since this is not a true Gatsby project
    try {
      await withDevServer({ cwd: builder.directory }, () => {}, true)
    } catch (error) {
      expect(normalize(error.message)).toMatchSnapshot()
    }
  })
  expect.assertions(1)
})

test('should start static service for frameworks without port, forced framework', async () => {
  await withSiteBuilder('site-with-remix', async (builder) => {
    await builder.withNetlifyToml({ config: { dev: { framework: 'remix' } } }).buildAsync()
    // a failure is expected since this is not a true remix project
    try {
      await withDevServer({ cwd: builder.directory }, () => {}, true)
    } catch (error) {
      expect(stripAnsi(error.message)).toMatch(`Failed running command: remix watch. Please verify 'remix' exists`)
    }
  })
  expect.assertions(1)
})

test('should start static service for frameworks without port, detected framework', async () => {
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
    try {
      await withDevServer({ cwd: builder.directory }, () => {}, true)
    } catch (error) {
      expect(stripAnsi(error.message)).toMatch(`Failed running command: remix watch. Please verify 'remix' exists`)
    }
  })
  expect.assertions(1)
})
