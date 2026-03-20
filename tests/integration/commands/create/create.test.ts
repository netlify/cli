import { beforeEach, describe, expect, test, vi } from 'vitest'
import execa from 'execa'

import { callCli } from '../../utils/call-cli.js'
import { cliPath } from '../../utils/cli-path.js'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.js'
import { answerWithValue, handleQuestions } from '../../utils/handle-questions.js'

vi.mock('../../../../src/lib/spinner.js', () => ({
  startSpinner: vi.fn(() => ({
    text: 'test',
    update: vi.fn(),
    stop: vi.fn(),
    clear: vi.fn(),
  })),
  stopSpinner: vi.fn(),
}))

const mockCreatedSite = {
  id: 'new_site_id',
  name: 'cool-new-site-abc123',
  admin_url: 'https://app.netlify.com/projects/cool-new-site-abc123',
  ssl_url: 'https://cool-new-site-abc123.netlify.app',
  url: 'http://cool-new-site-abc123.netlify.app',
}

const mockAgentRunner = {
  id: 'ar_123',
  site_id: 'new_site_id',
  state: 'new',
  created_at: '2025-01-15T10:30:00.000Z',
  updated_at: '2025-01-15T10:30:00.000Z',
}

const mockAgentRunnerDone = {
  ...mockAgentRunner,
  state: 'done',
  done_at: '2025-01-15T10:35:00.000Z',
}

const mockAgentRunnerError = {
  ...mockAgentRunner,
  state: 'error',
}

const baseRoutes = [
  { path: 'user', response: { name: 'test user' } },
  { path: 'accounts', response: [{ slug: 'test-account', name: 'Test Account' }] },
]

describe('create command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('--no-wait', () => {
    test('should create site and agent runner then return immediately', async (t) => {
      const routes = [
        ...baseRoutes,
        { path: 'test-account/sites', method: 'POST' as const, response: mockCreatedSite },
        { path: 'agent_runners', method: 'POST' as const, response: mockAgentRunner },
      ]

      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(routes, async ({ apiUrl }) => {
          const cliResponse = (await callCli(
            [
              'create',
              'Build a fancy portfolio site',
              '--agent',
              'claude',
              '--no-wait',
              '--account-slug',
              'test-account',
            ],
            getCLIOptions({ apiUrl, builder, env: { NETLIFY_SITE_ID: '' } }),
          )) as string

          expect(cliResponse).toContain('Project created: cool-new-site-abc123')
          expect(cliResponse).toContain('Agent run started!')
          expect(cliResponse).toContain('View progress in the browser:')
          expect(cliResponse).toContain(
            'https://app.netlify.com/projects/cool-new-site-abc123/agent-runs/ar_123/create',
          )
          expect(cliResponse).toContain('Check status from the CLI:')
          expect(cliResponse).toContain('netlify agents:show ar_123 --project cool-new-site-abc123')
        })
      })
    })

    test('should return JSON when --json and --no-wait flags are used', async (t) => {
      const routes = [
        ...baseRoutes,
        { path: 'test-account/sites', method: 'POST' as const, response: mockCreatedSite },
        { path: 'agent_runners', method: 'POST' as const, response: mockAgentRunner },
      ]

      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(routes, async ({ apiUrl }) => {
          const { stdout } = await execa(
            cliPath,
            ['create', 'Build a blog', '--agent', 'claude', '--no-wait', '--json', '--account-slug', 'test-account'],
            {
              cwd: builder.directory,
              env: { NETLIFY_API_URL: apiUrl, NETLIFY_AUTH_TOKEN: 'fake-token' },
            },
          )

          const parsed = JSON.parse(stdout) as {
            site: { id: string; name: string }
            agentRunner: { id: string; state: string; url: string }
          }
          expect(parsed.site.id).toBe('new_site_id')
          expect(parsed.site.name).toBe('cool-new-site-abc123')
          expect(parsed.agentRunner.id).toBe('ar_123')
          expect(parsed.agentRunner.state).toBe('new')
          expect(parsed.agentRunner.url).toContain('/agent-runs/ar_123/create')
        })
      })
    })
  })

  describe('with polling', () => {
    test('should poll until agent run completes and show site URL', async (t) => {
      const routes = [
        ...baseRoutes,
        { path: 'test-account/sites', method: 'POST' as const, response: mockCreatedSite },
        { path: 'agent_runners', method: 'POST' as const, response: mockAgentRunner },
        { path: 'agent_runners/ar_123', response: mockAgentRunnerDone },
        { path: 'sites/new_site_id', response: mockCreatedSite },
      ]

      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(routes, async ({ apiUrl }) => {
          const cliResponse = (await callCli(
            ['create', 'Build a fancy site', '--agent', 'claude', '--account-slug', 'test-account'],
            getCLIOptions({ apiUrl, builder, env: { NETLIFY_SITE_ID: '' } }),
          )) as string

          expect(cliResponse).toContain('Project created: cool-new-site-abc123')
          expect(cliResponse).toContain('Agent run complete!')
          expect(cliResponse).toContain('https://cool-new-site-abc123.netlify.app')
        })
      })
    })

    test('should show failure info when agent run errors', async (t) => {
      const routes = [
        ...baseRoutes,
        { path: 'test-account/sites', method: 'POST' as const, response: mockCreatedSite },
        { path: 'agent_runners', method: 'POST' as const, response: mockAgentRunner },
        { path: 'agent_runners/ar_123', response: mockAgentRunnerError },
        { path: 'sites/new_site_id', response: mockCreatedSite },
      ]

      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(routes, async ({ apiUrl }) => {
          const cliResponse = (await callCli(
            ['create', 'Build a broken site', '--agent', 'claude', '--account-slug', 'test-account'],
            getCLIOptions({ apiUrl, builder, env: { NETLIFY_SITE_ID: '' } }),
          )) as string

          expect(cliResponse).toContain('Project created: cool-new-site-abc123')
          expect(cliResponse).toContain('Agent run')
          expect(cliResponse).toContain('ERROR')
          expect(cliResponse).toContain('https://app.netlify.com/projects/cool-new-site-abc123/agent-runs/ar_123')
        })
      })
    })

    test('should return JSON when --json flag is used with polling', async (t) => {
      const routes = [
        ...baseRoutes,
        { path: 'test-account/sites', method: 'POST' as const, response: mockCreatedSite },
        { path: 'agent_runners', method: 'POST' as const, response: mockAgentRunner },
        { path: 'agent_runners/ar_123', response: mockAgentRunnerDone },
        { path: 'sites/new_site_id', response: mockCreatedSite },
      ]

      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(routes, async ({ apiUrl }) => {
          const { stdout } = await execa(
            cliPath,
            ['create', 'Build a blog', '--agent', 'claude', '--json', '--account-slug', 'test-account'],
            {
              cwd: builder.directory,
              env: { NETLIFY_API_URL: apiUrl, NETLIFY_AUTH_TOKEN: 'fake-token' },
            },
          )

          const parsed = JSON.parse(stdout) as {
            site: { id: string; url: string }
            agentRunner: { id: string; state: string }
          }
          expect(parsed.site.id).toBe('new_site_id')
          expect(parsed.site.url).toBe('https://cool-new-site-abc123.netlify.app')
          expect(parsed.agentRunner.id).toBe('ar_123')
          expect(parsed.agentRunner.state).toBe('done')
        })
      })
    })
  })

  describe('error handling', () => {
    test('should fail when site creation fails', async (t) => {
      const routes = [
        ...baseRoutes,
        { path: 'test-account/sites', method: 'POST' as const, status: 500, response: { error: 'Server error' } },
      ]

      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(routes, async ({ apiUrl }) => {
          await expect(
            callCli(
              ['create', 'Build a site', '--agent', 'claude', '--account-slug', 'test-account'],
              getCLIOptions({ apiUrl, builder, env: { NETLIFY_SITE_ID: '' } }),
            ),
          ).rejects.toThrow()
        })
      })
    })

    test('should fail when agent runner creation fails', async (t) => {
      const routes = [
        ...baseRoutes,
        { path: 'test-account/sites', method: 'POST' as const, response: mockCreatedSite },
        {
          path: 'agent_runners',
          method: 'POST' as const,
          status: 500,
          response: { error: 'Agent service unavailable' },
        },
      ]

      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(routes, async ({ apiUrl }) => {
          await expect(
            callCli(
              ['create', 'Build a site', '--agent', 'claude', '--account-slug', 'test-account'],
              getCLIOptions({ apiUrl, builder, env: { NETLIFY_SITE_ID: '' } }),
            ),
          ).rejects.toThrow()
        })
      })
    })
  })

  describe('validation', () => {
    test('should reject prompt that is too short', async (t) => {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(baseRoutes, async ({ apiUrl }) => {
          await expect(
            callCli(
              ['create', 'hi', '--agent', 'claude', '--account-slug', 'test-account'],
              getCLIOptions({ apiUrl, builder, env: { NETLIFY_SITE_ID: '' } }),
            ),
          ).rejects.toThrow('Please provide a more detailed prompt')
        })
      })
    })

    test('should reject invalid agent type', async (t) => {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(baseRoutes, async ({ apiUrl }) => {
          await expect(
            callCli(
              ['create', 'Build a great site', '--agent', 'invalid-agent', '--account-slug', 'test-account'],
              getCLIOptions({ apiUrl, builder, env: { NETLIFY_SITE_ID: '' } }),
            ),
          ).rejects.toThrow('Invalid agent')
        })
      })
    })
  })

  describe('interactive prompts', () => {
    test('should prompt for input when no prompt argument given', async (t) => {
      const routes = [
        ...baseRoutes,
        { path: 'test-account/sites', method: 'POST' as const, response: mockCreatedSite },
        { path: 'agent_runners', method: 'POST' as const, response: mockAgentRunner },
      ]

      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(routes, async ({ apiUrl }) => {
          const childProcess = execa(
            cliPath,
            ['create', '--agent', 'claude', '--no-wait', '--account-slug', 'test-account'],
            {
              cwd: builder.directory,
              env: { NETLIFY_API_URL: apiUrl, NETLIFY_AUTH_TOKEN: 'fake-token' },
            },
          )

          handleQuestions(childProcess, [
            {
              question: 'Describe the site you want to create',
              answer: answerWithValue('A beautiful landing page'),
            },
          ])

          const result = await childProcess
          expect(result.stdout).toContain('Agent run started!')
        })
      })
    })

    test('should prompt for account when multiple accounts exist', async (t) => {
      const multiAccountRoutes = [
        { path: 'user', response: { name: 'test user' } },
        {
          path: 'accounts',
          response: [
            { slug: 'team-alpha', name: 'Team Alpha' },
            { slug: 'team-beta', name: 'Team Beta' },
          ],
        },
        { path: 'team-alpha/sites', method: 'POST' as const, response: mockCreatedSite },
        { path: 'agent_runners', method: 'POST' as const, response: mockAgentRunner },
      ]

      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(multiAccountRoutes, async ({ apiUrl }) => {
          const childProcess = execa(cliPath, ['create', 'Build a portfolio', '--agent', 'claude', '--no-wait'], {
            cwd: builder.directory,
            env: { NETLIFY_API_URL: apiUrl, NETLIFY_AUTH_TOKEN: 'fake-token' },
          })

          handleQuestions(childProcess, [
            {
              question: 'Team',
              answer: answerWithValue(''),
            },
          ])

          const result = await childProcess
          expect(result.stdout).toContain('Agent run started!')
        })
      })
    })
  })

  describe('--name flag', () => {
    test('should pass name in site creation body', async (t) => {
      const routes = [
        ...baseRoutes,
        { path: 'test-account/sites', method: 'POST' as const, response: mockCreatedSite },
        { path: 'agent_runners', method: 'POST' as const, response: mockAgentRunner },
      ]

      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(routes, async ({ apiUrl, requests }) => {
          await callCli(
            [
              'create',
              'Build a site',
              '--agent',
              'claude',
              '--no-wait',
              '--account-slug',
              'test-account',
              '--name',
              'my-cool-site',
            ],
            getCLIOptions({ apiUrl, builder, env: { NETLIFY_SITE_ID: '' } }),
          )

          const siteCreateRequest = requests.find((r) => r.path === '/api/v1/test-account/sites' && r.method === 'POST')
          expect(siteCreateRequest).toBeDefined()
          expect(siteCreateRequest?.body).toEqual(
            expect.objectContaining({ name: 'my-cool-site', created_via: 'agent_runner' }),
          )
        })
      })
    })

    test('should fail after retries exhausted on name collision', async (t) => {
      const routes = [
        ...baseRoutes,
        {
          path: 'test-account/sites',
          method: 'POST' as const,
          status: 422,
          response: { error: 'subdomain must be unique' },
        },
      ]

      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(routes, async ({ apiUrl, requests }) => {
          await expect(
            callCli(
              ['create', 'Build a site', '--agent', 'claude', '--account-slug', 'test-account', '--name', 'taken-name'],
              getCLIOptions({ apiUrl, builder, env: { NETLIFY_SITE_ID: '' } }),
            ),
          ).rejects.toThrow('already taken')

          const siteCreateRequests = requests.filter(
            (r) => r.path === '/api/v1/test-account/sites' && r.method === 'POST',
          )
          // Original attempt + 2 retries = 3 total
          expect(siteCreateRequests).toHaveLength(3)
        })
      })
    })

    test('should not retry on 422 when no --name is given', async (t) => {
      const routes = [
        ...baseRoutes,
        {
          path: 'test-account/sites',
          method: 'POST' as const,
          status: 422,
          response: { error: 'subdomain must be unique' },
        },
      ]

      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(routes, async ({ apiUrl, requests }) => {
          await expect(
            callCli(
              ['create', 'Build a site', '--agent', 'claude', '--account-slug', 'test-account'],
              getCLIOptions({ apiUrl, builder, env: { NETLIFY_SITE_ID: '' } }),
            ),
          ).rejects.toThrow()

          const siteCreateRequests = requests.filter(
            (r) => r.path === '/api/v1/test-account/sites' && r.method === 'POST',
          )
          // Should only try once without --name
          expect(siteCreateRequests).toHaveLength(1)
        })
      })
    })
  })

  describe('source download', () => {
    const mockAgentRunnerDoneWithDeploy = {
      ...mockAgentRunner,
      state: 'done',
      done_at: '2025-01-15T10:35:00.000Z',
      latest_session_deploy_id: 'deploy_abc',
    }

    test('should attempt to download source when agent run succeeds with deploy', async (t) => {
      const routes = [
        ...baseRoutes,
        { path: 'test-account/sites', method: 'POST' as const, response: mockCreatedSite },
        { path: 'agent_runners', method: 'POST' as const, response: mockAgentRunner },
        { path: 'agent_runners/ar_123', response: mockAgentRunnerDoneWithDeploy },
        { path: 'sites/new_site_id', response: mockCreatedSite },
        { path: 'deploys/deploy_abc/download', response: { url: 'http://localhost:0/fake-source.zip' } },
      ]

      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(routes, async ({ apiUrl, requests }) => {
          // The download will fail because the fake URL is unreachable, but the command
          // should still succeed (download failure is non-fatal) and we can verify
          // that the deploy download endpoint was called with the correct deploy ID
          const cliResponse = (await callCli(
            ['create', 'Build a site', '--agent', 'claude', '--account-slug', 'test-account'],
            getCLIOptions({ apiUrl, builder, env: { NETLIFY_SITE_ID: '' } }),
          )) as string

          expect(cliResponse).toContain('Agent run complete!')
          expect(cliResponse).toContain('Failed to download source')

          const downloadRequest = requests.find(
            (r) => r.path === '/api/v1/deploys/deploy_abc/download' && r.method === 'GET',
          )
          expect(downloadRequest).toBeDefined()
        })
      })
    })

    test('should not attempt download on --no-wait', async (t) => {
      const routes = [
        ...baseRoutes,
        { path: 'test-account/sites', method: 'POST' as const, response: mockCreatedSite },
        { path: 'agent_runners', method: 'POST' as const, response: mockAgentRunner },
      ]

      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(routes, async ({ apiUrl, requests }) => {
          await callCli(
            ['create', 'Build a site', '--agent', 'claude', '--no-wait', '--account-slug', 'test-account'],
            getCLIOptions({ apiUrl, builder, env: { NETLIFY_SITE_ID: '' } }),
          )

          const downloadRequest = requests.find((r) => r.path.includes('deploys') && r.path.includes('download'))
          expect(downloadRequest).toBeUndefined()
        })
      })
    })

    test('should not attempt download on agent error', async (t) => {
      const routes = [
        ...baseRoutes,
        { path: 'test-account/sites', method: 'POST' as const, response: mockCreatedSite },
        { path: 'agent_runners', method: 'POST' as const, response: mockAgentRunner },
        { path: 'agent_runners/ar_123', response: mockAgentRunnerError },
        { path: 'sites/new_site_id', response: mockCreatedSite },
      ]

      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(routes, async ({ apiUrl, requests }) => {
          await callCli(
            ['create', 'Build a broken site', '--agent', 'claude', '--account-slug', 'test-account'],
            getCLIOptions({ apiUrl, builder, env: { NETLIFY_SITE_ID: '' } }),
          )

          const downloadRequest = requests.find((r) => r.path.includes('deploys') && r.path.includes('download'))
          expect(downloadRequest).toBeUndefined()
        })
      })
    })

    test('should skip download when no deploy ID on agent runner', async (t) => {
      const routes = [
        ...baseRoutes,
        { path: 'test-account/sites', method: 'POST' as const, response: mockCreatedSite },
        { path: 'agent_runners', method: 'POST' as const, response: mockAgentRunner },
        { path: 'agent_runners/ar_123', response: mockAgentRunnerDone },
        { path: 'sites/new_site_id', response: mockCreatedSite },
      ]

      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(routes, async ({ apiUrl, requests }) => {
          const cliResponse = (await callCli(
            ['create', 'Build a site', '--agent', 'claude', '--account-slug', 'test-account'],
            getCLIOptions({ apiUrl, builder, env: { NETLIFY_SITE_ID: '' } }),
          )) as string

          expect(cliResponse).toContain('Agent run complete!')
          expect(cliResponse).toContain('No deploy found')

          const downloadRequest = requests.find((r) => r.path.includes('deploys') && r.path.includes('download'))
          expect(downloadRequest).toBeUndefined()
        })
      })
    })
  })

  describe('API request validation', () => {
    test('should send created_via: agent_runner when creating site', async (t) => {
      const routes = [
        ...baseRoutes,
        { path: 'test-account/sites', method: 'POST' as const, response: mockCreatedSite },
        { path: 'agent_runners', method: 'POST' as const, response: mockAgentRunner },
      ]

      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(routes, async ({ apiUrl, requests }) => {
          await callCli(
            ['create', 'Build a site', '--agent', 'claude', '--no-wait', '--account-slug', 'test-account'],
            getCLIOptions({ apiUrl, builder, env: { NETLIFY_SITE_ID: '' } }),
          )

          const siteCreateRequest = requests.find((r) => r.path === '/api/v1/test-account/sites' && r.method === 'POST')
          expect(siteCreateRequest).toBeDefined()
          expect(siteCreateRequest?.body).toEqual(expect.objectContaining({ created_via: 'agent_runner' }))
        })
      })
    })

    test('should send mode: create and prompt when creating agent runner', async (t) => {
      const routes = [
        ...baseRoutes,
        { path: 'test-account/sites', method: 'POST' as const, response: mockCreatedSite },
        { path: 'agent_runners', method: 'POST' as const, response: mockAgentRunner },
      ]

      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(routes, async ({ apiUrl, requests }) => {
          await callCli(
            [
              'create',
              'Build a blog with dark mode',
              '--agent',
              'claude',
              '--no-wait',
              '--account-slug',
              'test-account',
            ],
            getCLIOptions({ apiUrl, builder, env: { NETLIFY_SITE_ID: '' } }),
          )

          const agentRunnerRequest = requests.find((r) => r.path.includes('agent_runners') && r.method === 'POST')
          expect(agentRunnerRequest).toBeDefined()
          expect(agentRunnerRequest?.body).toEqual(
            expect.objectContaining({
              mode: 'create',
              prompt: 'Build a blog with dark mode',
              agent: 'claude',
            }),
          )
        })
      })
    })
  })
})
