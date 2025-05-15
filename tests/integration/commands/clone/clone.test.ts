import { sep } from 'node:path'

import { describe, expect, it, beforeEach } from 'vitest'
import js from 'dedent'
import stripAnsi from 'strip-ansi'

import { withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.js'
import { answerWithValue, CONFIRM, DOWN, handleQuestions } from '../../utils/handle-questions.js'
import { createMock } from '../../utils/mock-execa.js'
import execa from 'execa'
import { cliPath } from '../../utils/cli-path.js'

describe.concurrent('clone command', () => {
  let execaMock: Awaited<ReturnType<typeof createMock>>[0]

  beforeEach(async () => {
    ;[execaMock] = await createMock(js`
      module.exports = function execa(command, args) {
        // Mock git clone command
        if (command === 'git' && args[0] === 'clone') {
          const targetDir = args[2]
          return require('fs/promises').mkdir(targetDir, { recursive: true })
            .then(() => {
              const stdout = 'Mocked git clone received: ' + command + ' ' + args.join(' ')
              console.log(stdout)
              return { stdout, stderr: '' }
            })
        }
        // For any other command, use the real execa
        // Normalize paths for Windows
        const realExeca = require('${require.resolve('execa').split(sep).join('/')}')
        // execa's APi is... really weird
        const result = Promise.resolve(realExeca(command, args))
        result.unref = () => {}
        return result
      }
    `)
  })

  const SITE_INFO_FIXTURE = {
    id: 'site_id',
    name: 'test-site',
    account_slug: 'test-account',
    ssl_url: 'https://test-site.netlify.app',
    admin_url: 'https://app.netlify.com/projects/test-site',
    build_settings: {
      repo_url: 'https://github.com/vibecoder/my-unicorn',
    },
  }
  const API_ROUTES_FIXTURE = [
    {
      path: 'sites',
      response: [SITE_INFO_FIXTURE],
    },
    {
      path: 'sites/site_id',
      response: SITE_INFO_FIXTURE,
    },
    {
      path: 'accounts',
      response: [{ slug: SITE_INFO_FIXTURE.account_slug }],
    },
  ]

  // TODO(serhalp): There is no established pattern across this entire codebase for running commands
  // without authentication, and I can't seem to get it to work.
  it.todo('prints an error and exits if not authenticated')

  it("clones a repo and links it to the one project connected to that repo's HTTPS URL", async (t) => {
    const routes = [...API_ROUTES_FIXTURE]
    const questions = [
      {
        question: 'Where should we clone the repository?',
        answer: CONFIRM,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(
        routes,
        async ({ apiUrl }) => {
          const childProcess = execa(cliPath, ['clone', 'git@github.com:vibecoder/my-unicorn.git'], {
            cwd: builder.directory,
            env: {
              NETLIFY_API_URL: apiUrl,
              NETLIFY_AUTH_TOKEN: 'fake-token',
              ...execaMock,
            },
          })

          handleQuestions(childProcess, questions)
          const { stdout, stderr } = await childProcess

          // Honestly, I have no idea why these two are in stderr, but it's specific to
          // the integration test setup so we'll just live with it for now.
          expect(stripAnsi(stderr)).toContain('✔ Cloned repository to ./my-unicorn')
          expect(stripAnsi(stderr)).toContain('✔ Found 1 project connected to https://github.com/vibecoder/my-unicorn')

          expect(stdout).toContain('Mocked git clone received: git clone git@github.com:vibecoder/my-unicorn.git')

          expect(stripAnsi(stdout)).toContain(`✔ Linked to test-site

✔ Your project is ready to go!
→ Next, enter your project directory using cd ./my-unicorn

→ You can now run other netlify CLI commands in this directory
→ To build and deploy your project: netlify deploy
→ To see all available commands: netlify help
`)

          // Verify the site is properly linked
          const { stdout: linkOutput } = await execa(cliPath, ['link'], {
            cwd: `${builder.directory}/my-unicorn`,
            env: {
              NETLIFY_API_URL: apiUrl,
              NETLIFY_AUTH_TOKEN: 'fake-token',
              ...execaMock,
            },
            reject: false,
          })
          expect(stripAnsi(linkOutput)).toContain(`Project already linked to "test-site"
Admin url: https://app.netlify.com/projects/test-site

To unlink this project, run: netlify unlink`)
        },
        true,
      )
    })
  })

  it('clones into the provided `[targetDir]` if arg is provided', async (t) => {
    const routes = [...API_ROUTES_FIXTURE]
    const questions: never[] = [] // no interactive prompts at all

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(
        routes,
        async ({ apiUrl }) => {
          const childProcess = execa(cliPath, ['clone', 'git@github.com:vibecoder/my-unicorn.git', './younicorn'], {
            cwd: builder.directory,
            env: {
              NETLIFY_API_URL: apiUrl,
              NETLIFY_AUTH_TOKEN: 'fake-token',
              ...execaMock,
            },
            reject: false,
          })

          handleQuestions(childProcess, questions)
          const { stdout, stderr } = await childProcess

          // Honestly, I have no idea why these two are in stderr, but it's specific to
          // the integration test setup so we'll just live with it for now.
          expect(stripAnsi(stderr)).toContain('✔ Cloned repository to ./younicorn')
          expect(stripAnsi(stderr)).toContain('✔ Found 1 project connected to https://github.com/vibecoder/my-unicorn')

          expect(stdout).toContain(
            'Mocked git clone received: git clone git@github.com:vibecoder/my-unicorn.git ./younicorn',
          )

          expect(stripAnsi(stdout)).toContain(`✔ Linked to test-site

✔ Your project is ready to go!
→ Next, enter your project directory using cd ./younicorn`)

          // Verify the site is properly linked
          const { stdout: linkOutput } = await execa(cliPath, ['link'], {
            cwd: `${builder.directory}/younicorn`,
            env: {
              NETLIFY_API_URL: apiUrl,
              NETLIFY_AUTH_TOKEN: 'fake-token',
              ...execaMock,
            },
          })
          expect(linkOutput).toContain('Project already linked to "test-site"')
        },
        true,
      )
    })
  })

  it('clones into the entered target dir if user enters one when prompted', async (t) => {
    const routes = [...API_ROUTES_FIXTURE]
    const questions = [
      {
        question: 'Where should we clone the repository?',
        answer: answerWithValue('younicorn'),
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(
        routes,
        async ({ apiUrl }) => {
          const childProcess = execa(cliPath, ['clone', 'git@github.com:vibecoder/my-unicorn.git'], {
            cwd: builder.directory,
            env: {
              NETLIFY_API_URL: apiUrl,
              NETLIFY_AUTH_TOKEN: 'fake-token',
              ...execaMock,
            },
          })

          handleQuestions(childProcess, questions)
          const { stdout, stderr } = await childProcess

          // Honestly, I have no idea why these two are in stderr, but it's specific to
          // the integration test setup so we'll just live with it for now.
          expect(stripAnsi(stderr)).toContain('✔ Cloned repository to younicorn')
          expect(stripAnsi(stderr)).toContain('✔ Found 1 project connected to https://github.com/vibecoder/my-unicorn')

          expect(stdout).toContain('Mocked git clone received: git clone git@github.com:vibecoder/my-unicorn.git')

          expect(stripAnsi(stdout)).toContain(`✔ Linked to test-site

✔ Your project is ready to go!
→ Next, enter your project directory using cd younicorn

→ You can now run other netlify CLI commands in this directory
→ To build and deploy your project: netlify deploy
→ To see all available commands: netlify help
`)

          // Verify the site is properly linked
          const { stdout: linkOutput } = await execa(cliPath, ['link'], {
            cwd: `${builder.directory}/younicorn`,
            env: {
              NETLIFY_API_URL: apiUrl,
              NETLIFY_AUTH_TOKEN: 'fake-token',
              ...execaMock,
            },
            reject: false,
          })
          expect(stripAnsi(linkOutput)).toContain(`Project already linked to "test-site"
Admin url: https://app.netlify.com/projects/test-site

To unlink this project, run: netlify unlink`)
        },
        true,
      )
    })
  })

  it('links to project with given `--id` when provided', async (t) => {
    const otherSiteInfo = {
      id: 'other-site-id',
      name: 'other-site',
      account_slug: 'other-account',
      ssl_url: 'https://other-site.netlify.app',
      admin_url: 'https://app.netlify.com/projects/other-site',
      build_settings: {
        repo_url: 'https://github.com/vibecoder/my-unicorn',
      },
    }
    const routes = [
      {
        path: 'sites',
        response: [otherSiteInfo, SITE_INFO_FIXTURE],
      },
      {
        path: 'sites/site_id',
        response: SITE_INFO_FIXTURE,
      },
      {
        path: 'accounts',
        response: [{ slug: SITE_INFO_FIXTURE.account_slug }, { slug: otherSiteInfo.account_slug }],
      },
    ]
    const questions = [
      {
        question: 'Where should we clone the repository?',
        answer: CONFIRM,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(
        routes,
        async ({ apiUrl }) => {
          const childProcess = execa(cliPath, ['clone', '--id', 'site_id', 'git@github.com:vibecoder/my-unicorn.git'], {
            cwd: builder.directory,
            env: {
              NETLIFY_API_URL: apiUrl,
              NETLIFY_AUTH_TOKEN: 'fake-token',
              ...execaMock,
            },
          })

          handleQuestions(childProcess, questions)
          const { stdout } = await childProcess

          expect(stripAnsi(stdout)).toContain(`✔ Linked to test-site`)
        },
        true,
      )
    })
  })

  it('links to project with given `--name` when provided', async (t) => {
    const otherSiteInfo = {
      id: 'other-site-id',
      name: 'other-site',
      account_slug: 'other-account',
      ssl_url: 'https://other-site.netlify.app',
      admin_url: 'https://app.netlify.com/projects/other-site',
      build_settings: {
        repo_url: 'https://github.com/vibecoder/my-unicorn',
      },
    }
    const routes = [
      {
        path: 'sites',
        response: [otherSiteInfo, SITE_INFO_FIXTURE],
      },
      {
        path: 'sites/site_id',
        response: SITE_INFO_FIXTURE,
      },
      {
        path: 'accounts',
        response: [{ slug: SITE_INFO_FIXTURE.account_slug }, { slug: otherSiteInfo.account_slug }],
      },
    ]
    const questions = [
      {
        question: 'Where should we clone the repository?',
        answer: CONFIRM,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(
        routes,
        async ({ apiUrl }) => {
          const childProcess = execa(
            cliPath,
            ['clone', '--name', 'test-site', 'git@github.com:vibecoder/my-unicorn.git'],
            {
              cwd: builder.directory,
              env: {
                NETLIFY_API_URL: apiUrl,
                NETLIFY_AUTH_TOKEN: 'fake-token',
                ...execaMock,
              },
            },
          )

          handleQuestions(childProcess, questions)
          const { stdout } = await childProcess

          expect(stripAnsi(stdout)).toContain(`✔ Linked to test-site`)
        },
        true,
      )
    })
  })

  it('prompts user when multiple projects match git repo HTTPS URL', async (t) => {
    const otherSiteInfo = {
      id: 'other-site-id',
      name: 'other-site',
      account_slug: 'other-account',
      ssl_url: 'https://other-site.netlify.app',
      admin_url: 'https://app.netlify.com/projects/other-site',
      build_settings: {
        repo_url: 'https://github.com/vibecoder/my-unicorn',
      },
    }
    const routes = [
      {
        path: 'sites',
        response: [otherSiteInfo, SITE_INFO_FIXTURE],
      },
      {
        path: 'sites/site_id',
        response: SITE_INFO_FIXTURE,
      },
      {
        path: 'accounts',
        response: [{ slug: SITE_INFO_FIXTURE.account_slug }, { slug: otherSiteInfo.account_slug }],
      },
    ]
    const questions = [
      {
        question: 'Where should we clone the repository?',
        answer: CONFIRM,
      },
      { question: 'Which project do you want to link?', answer: answerWithValue(DOWN) },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(
        routes,
        async ({ apiUrl }) => {
          const childProcess = execa(cliPath, ['clone', 'git@github.com:vibecoder/my-unicorn.git'], {
            cwd: builder.directory,
            env: {
              NETLIFY_API_URL: apiUrl,
              NETLIFY_AUTH_TOKEN: 'fake-token',
              ...execaMock,
            },
          })

          handleQuestions(childProcess, questions)
          const { stdout } = await childProcess

          expect(stripAnsi(stdout)).toContain(`✔ Linked to test-site`)
        },
        true,
      )
    })
  })

  it('prints an error and exits when no project is connected to the git repo HTTPS URL', async (t) => {
    const otherSiteInfo = {
      id: 'other-site-id',
      name: 'other-site',
      account_slug: 'other-account',
      ssl_url: 'https://other-site.netlify.app',
      admin_url: 'https://app.netlify.com/projects/other-site',
      build_settings: {
        repo_url: 'https://github.com/vibecoderking/my-failure',
      },
    }
    const routes = [
      {
        path: 'sites',
        response: [otherSiteInfo],
      },
      {
        path: 'accounts',
        response: [{ slug: otherSiteInfo.account_slug }],
      },
    ]
    const questions = [
      {
        question: 'Where should we clone the repository?',
        answer: CONFIRM,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(
        routes,
        async ({ apiUrl }) => {
          const childProcess = execa(cliPath, ['clone', 'git@github.com:vibecoder/my-unicorn.git'], {
            cwd: builder.directory,
            env: {
              NETLIFY_API_URL: apiUrl,
              NETLIFY_AUTH_TOKEN: 'fake-token',
              ...execaMock,
            },
            reject: false,
          })

          handleQuestions(childProcess, questions)
          const { stdout } = await childProcess

          expect(stripAnsi(stdout)).toContain(`No matching project found

No project found with the remote https://github.com/vibecoder/my-unicorn.

Double check you are in the correct working directory and a remote origin repo is configured.

Run git remote -v to see a list of your git remotes.`)
        },
        true,
      )
    })
  })

  it('prints an error and exits given an invalid git repo specifier', async (t) => {
    const routes = [
      {
        path: 'sites',
        response: [],
      },
      {
        path: 'accounts',
        response: [],
      },
    ]
    const questions = [
      {
        question: 'Where should we clone the repository?',
        answer: CONFIRM,
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(
        routes,
        async ({ apiUrl }) => {
          const childProcess = execa(cliPath, ['clone', 'git@github.com:vibecoder'], {
            cwd: builder.directory,
            env: {
              NETLIFY_API_URL: apiUrl,
              NETLIFY_AUTH_TOKEN: 'fake-token',
              ...execaMock,
            },
            reject: false,
          })

          handleQuestions(childProcess, questions)
          const { stderr } = await childProcess

          expect(stderr).toContain('Invalid repository URL: git@github.com:vibecoder')
        },
        true,
      )
    })
  })
})
