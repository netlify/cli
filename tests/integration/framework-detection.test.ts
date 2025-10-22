import execa from 'execa'

import { describe, test } from 'vitest'

import { cliPath } from './utils/cli-path.js'
import { getExecaOptions, withDevServer } from './utils/dev-server.js'
import { DOWN, answerWithValue, handleQuestions } from './utils/handle-questions.js'
import { withSiteBuilder } from './utils/site-builder.js'
import { normalize } from './utils/snapshots.js'

const content = 'Hello World!'

// Normalize random ports. Not only are these ports random, but since the number of digits
// in the port can vary, the formatting of the ASCII box drawn around it also varies.
const normalizeSnapshot = (
  snapshot: string,
  opts: { duration?: boolean | undefined; filePath?: boolean | undefined } = {},
) =>
  normalize(snapshot, opts).replace(
    // eslint-disable-next-line no-irregular-whitespace
    /⬥ Static server listening to \d+[\s╭─│─╰╮╯⬥ ]+ Local dev server ready: http:\/\/localhost:\d+ [\s╭─│─╰╮╯]+/m,
    `⬥ Static server listening to <SNAPSHOT_PORT_NORMALIZED>

   ┌──────────────────────────────────────────────────────────────────────────┐
   │                                                                          │
   │     Local dev server ready: http://localhost:<SNAPSHOT_PORT_NORMALIZED>  │
   │                                                                          │
   └──────────────────────────────────────────────────────────────────────────┘`,
  )

describe.concurrent('frameworks/framework-detection', () => {
  test('should default to process.cwd() and static server', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withContentFile({
          path: 'index.html',
          content,
        })
        .build()

      await withDevServer({ cwd: builder.directory }, async ({ output, url }) => {
        const response = await fetch(url)
        const responseContent = await response.text()

        t.expect(responseContent).toEqual(content)
        t.expect(normalizeSnapshot(output, { duration: true, filePath: true })).toMatchSnapshot()
      })
    })
  })

  test('should use static server when --dir flag is passed', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withContentFile({
          path: 'public/index.html',
          content,
        })
        .build()

      await withDevServer({ cwd: builder.directory, args: ['--dir', 'public'] }, async ({ output, url }) => {
        const response = await fetch(url)
        const responseContent = await response.text()

        t.expect(responseContent).toEqual(content)
        t.expect(normalizeSnapshot(output, { duration: true, filePath: true })).toMatchSnapshot()
      })
    })
  })

  test('should use static server when framework is set to #static', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withContentFile({
          path: 'index.html',
          content,
        })
        .withNetlifyToml({ config: { dev: { framework: '#static' } } })
        .build()

      await withDevServer({ cwd: builder.directory }, async ({ output, url }) => {
        const response = await fetch(url)
        const responseContent = await response.text()

        t.expect(responseContent).toEqual(content)
        t.expect(normalizeSnapshot(output, { duration: true, filePath: true })).toMatchSnapshot()
      })
    })
  })

  test('should warn if using static server and `targetPort` is configured', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withContentFile({
          path: 'public/index.html',
          content,
        })
        .build()

      await withDevServer(
        { cwd: builder.directory, args: ['--dir', 'public', '--target-port', '3000'] },
        async ({ output, url }) => {
          const response = await fetch(url)
          const responseContent = await response.text()

          t.expect(responseContent).toEqual(content)
          t.expect(normalizeSnapshot(output, { duration: true, filePath: true })).toMatchSnapshot()
        },
      )
    })
  })

  test('should run `command` when both `command` and `targetPort` are configured', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.withNetlifyToml({ config: { build: { publish: 'public' } } }).build()

      try {
        await withDevServer(
          { cwd: builder.directory, args: ['--command', 'echo hello', '--target-port', '3000'] },
          async () => {},
          true,
        )
        // a failure is expected since we use `echo hello` instead of starting a server
        t.expect.unreachable()
      } catch (err) {
        t.expect(err).toHaveProperty('stdout')
        t.expect(
          normalizeSnapshot((err as execa.ExecaReturnValue).stdout, { duration: true, filePath: true }),
        ).toMatchSnapshot()
      }
    })
  })

  test('should force a specific framework when configured', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.withNetlifyToml({ config: { dev: { framework: 'create-react-app' } } }).build()

      try {
        await withDevServer({ cwd: builder.directory }, async () => {}, true)
        // a failure is expected since this is not a true create-react-app project
        t.expect.unreachable()
      } catch (err) {
        t.expect(err).toHaveProperty('stdout')
        t.expect(
          normalizeSnapshot((err as execa.ExecaReturnValue).stdout, { duration: true, filePath: true }),
        ).toMatchSnapshot()
      }
    })
  })

  test('should throw when forcing a non supported framework', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.withNetlifyToml({ config: { dev: { framework: 'to-infinity-and-beyond-js' } } }).build()

      try {
        await withDevServer({ cwd: builder.directory }, async () => {}, true)
        t.expect.unreachable()
      } catch (err) {
        t.expect(err).toHaveProperty('stdout')
        t.expect(
          normalizeSnapshot((err as execa.ExecaReturnValue).stdout, { duration: true, filePath: true }),
        ).toMatchSnapshot()
      }
    })
  })

  test('should detect a known framework', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withPackageJson({
          packageJson: { dependencies: { 'react-scripts': '1.0.0' }, scripts: { start: 'react-scripts start' } },
        })
        .build()

      try {
        await withDevServer({ cwd: builder.directory }, async () => {}, true)
        t.expect.unreachable()
      } catch (err) {
        t.expect(err).toHaveProperty('stdout')
        t.expect(
          normalizeSnapshot((err as execa.ExecaReturnValue).stdout, { duration: true, filePath: true }),
        ).toMatchSnapshot()
      }
    })
  })

  test('should throw if framework=#custom but command is missing', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.withNetlifyToml({ config: { dev: { framework: '#custom' } } }).build()

      try {
        await withDevServer({ cwd: builder.directory, args: ['--target-port', '3000'] }, async () => {}, true)
        t.expect.unreachable()
      } catch (err) {
        t.expect(err).toHaveProperty('stdout')
        t.expect(
          normalizeSnapshot((err as execa.ExecaReturnValue).stdout, { duration: true, filePath: true }),
        ).toMatchSnapshot()
      }
    })
  })

  test('should throw if framework=#custom but targetPort is missing', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.withNetlifyToml({ config: { dev: { framework: '#custom' } } }).build()

      try {
        await withDevServer({ cwd: builder.directory, args: ['--command', 'echo hello'] }, async () => {}, true)
        t.expect.unreachable()
      } catch (err) {
        t.expect(err).toHaveProperty('stdout')
        t.expect(
          normalizeSnapshot((err as execa.ExecaReturnValue).stdout, { duration: true, filePath: true }),
        ).toMatchSnapshot()
      }
    })
  })

  test('should start custom command if framework=#custom, command and targetPort are configured', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.withNetlifyToml({ config: { dev: { framework: '#custom', publish: 'public' } } }).build()

      try {
        await withDevServer(
          { cwd: builder.directory, args: ['--command', 'echo hello', '--target-port', '3000'] },
          async () => {},
          true,
        )
        t.expect.unreachable()
      } catch (err) {
        t.expect(err).toHaveProperty('stdout')
        t.expect(
          normalizeSnapshot((err as execa.ExecaReturnValue).stdout, { duration: true, filePath: true }),
        ).toMatchSnapshot()
      }
    })
  })

  test(`should print specific error when command doesn't exist`, async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      try {
        await withDevServer(
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
          async () => {},
          true,
        )
        t.expect.unreachable()
      } catch (err) {
        t.expect(err).toHaveProperty('stdout')
        t.expect(
          normalizeSnapshot((err as execa.ExecaReturnValue).stdout, { duration: true, filePath: true }),
        ).toMatchSnapshot()
      }
    })
  })

  test('should prompt when multiple frameworks are detected', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withPackageJson({
          packageJson: {
            dependencies: { 'react-scripts': '1.0.0', gatsby: '^3.0.0' },
            scripts: { start: 'react-scripts start', develop: 'gatsby develop' },
          },
        })
        .withContentFile({ path: 'gatsby-config.js', content: '' })
        .build()

      // a failure is expected since this is not a true framework project
      const asyncErrorBlock = async () => {
        const childProcess = execa(
          cliPath,
          ['dev', '--offline'],
          getExecaOptions({ cwd: builder.directory, env: { CI: 'false' } }),
        )

        handleQuestions(childProcess, [
          {
            question: 'Multiple possible dev commands found',
            answer: answerWithValue(DOWN),
          },
        ])

        await childProcess
      }
      try {
        await asyncErrorBlock()
        t.expect.unreachable()
      } catch (err) {
        t.expect(err).toHaveProperty('stdout')
        t.expect(
          normalizeSnapshot((err as execa.ExecaReturnValue).stdout, { duration: true, filePath: true }),
        ).toMatchSnapshot()
      }
    })
  })

  test('should fail in CI when multiple frameworks are detected', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withPackageJson({
          packageJson: {
            dependencies: { 'react-scripts': '1.0.0', gatsby: '^3.0.0' },
            scripts: { start: 'react-scripts start', develop: 'gatsby develop' },
          },
        })
        .withContentFile({ path: 'gatsby-config.js', content: '' })
        .build()

      // a failure is expected since this is not a true framework project
      const asyncErrorBlock = async () => {
        const childProcess = execa(
          cliPath,
          ['dev', '--offline'],
          getExecaOptions({ cwd: builder.directory, env: { CI: 'true' } }),
        )
        await childProcess
      }
      try {
        await asyncErrorBlock()
        t.expect.unreachable()
      } catch (err) {
        t.expect(err).toHaveProperty('stdout')
        t.expect(
          normalizeSnapshot((err as execa.ExecaReturnValue).stdout, { duration: true, filePath: true }).includes(
            'Detected commands for: Gatsby, Create React App. Update your settings to specify which to use. Refer to https://ntl.fyi/dev-monorepo for more information.',
          ),
        )
        t.expect(err).toHaveProperty('exitCode')
        t.expect((err as execa.ExecaReturnValue).exitCode).toBe(1)
      }
    })
  })

  test('should not run framework detection if command and targetPort are configured', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.withContentFile({ path: 'config.toml', content: '' }).build()

      try {
        await withDevServer(
          { cwd: builder.directory, args: ['--command', 'echo hello', '--target-port', '3000'] },
          async () => {},
          true,
        )
        // a failure is expected since the command exits early
        t.expect.unreachable()
      } catch (err) {
        t.expect(err).toHaveProperty('stdout')
        t.expect(
          normalizeSnapshot((err as execa.ExecaReturnValue).stdout, { duration: true, filePath: true }),
        ).toMatchSnapshot()
      }
    })
  })

  test('should filter frameworks with no dev command', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withContentFile({
          path: 'index.html',
          content,
        })
        .withPackageJson({
          packageJson: { dependencies: { gulp: '1.0.0' } },
        })
        .build()

      await withDevServer({ cwd: builder.directory }, async ({ output, url }) => {
        const response = await fetch(url)
        const responseContent = await response.text()

        t.expect(responseContent).toEqual(content)
        t.expect(normalizeSnapshot(output, { duration: true, filePath: true })).toMatchSnapshot()
      })
    })
  })

  test('should pass framework-info env to framework sub process', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withPackageJson({
          packageJson: {
            dependencies: { '@redwoodjs/core': '^2.0.0' },
            scripts: { dev: 'node -p process.env.NODE_VERSION' },
          },
        })
        .build()

      try {
        await withDevServer({ cwd: builder.directory }, async () => {}, true)
        // a failure is expected since this is not a true Gatsby project
        t.expect.unreachable()
      } catch (err) {
        t.expect(err).toHaveProperty('stdout')
        t.expect(
          normalizeSnapshot((err as execa.ExecaReturnValue).stdout, { duration: true, filePath: true }),
        ).toMatchSnapshot()
      }
    })
  })

  test('should start static service for frameworks without port, forced framework', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.withNetlifyToml({ config: { dev: { framework: 'remix' } } }).build()

      try {
        await withDevServer({ cwd: builder.directory }, async () => {}, true)
        // a failure is expected since this is not a true remix project
        t.expect.unreachable()
      } catch (err) {
        t.expect(err).toHaveProperty('stdout')
        t.expect((err as execa.ExecaReturnValue).stdout).toContain(
          `Failed running command: remix watch. Please verify 'remix' exists`,
        )
      }
    })
  })

  test('should start static service for frameworks without port, detected framework', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder
        .withPackageJson({
          packageJson: {
            dependencies: { remix: '^1.0.0', '@remix-run/netlify': '^1.0.0' },
            scripts: {},
          },
        })
        .withContentFile({ path: 'remix.config.js', content: '' })
        .build()

      try {
        await withDevServer({ cwd: builder.directory }, async () => {}, true)
        // a failure is expected since this is not a true remix project
        t.expect.unreachable()
      } catch (err) {
        t.expect(err).toHaveProperty('stdout')
        t.expect((err as execa.ExecaReturnValue).stdout).toContain(
          `Failed running command: remix watch. Please verify 'remix' exists`,
        )
      }
    })
  })

  test('should run and serve a production build when using the `serve` command', async (t) => {
    await withSiteBuilder(t, async (builder) => {
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
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const { mkdir, writeFile } = require('node:fs/promises') as typeof import('node:fs/promises')

              const generatedFunctionsDir = 'new_functions'
              // @ts-expect-error FIXME(ndhoule): Unsure if this is a legitimate error or bad types
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
        .build()

      await withDevServer(
        { cwd: builder.directory, context: null, debug: true, serve: true },
        async ({ output, url }) => {
          const response = await fetch(`${url}/hello`)
          const responseJson = await response.json()
          t.expect(responseJson).toStrictEqual({ CONTEXT_CHECK: 'PRODUCTION' })

          const normalizedText = normalizeSnapshot(output, { duration: true, filePath: true })
          t.expect(
            normalizedText.includes(
              `Changes will not be hot-reloaded, so if you need to rebuild your project you must exit and run 'netlify serve' again`,
            ),
          ).toEqual(true)
        },
      )
    })
  })
})
