import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import stripAnsi from 'strip-ansi'

import BaseCommand from '../../../../src/commands/base-command.js'
import { createLinkCommand } from '../../../../src/commands/link/index.js'
import { getEnvironmentVariables, withMockApi, type MockApiTestContext, type Route } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.js'

type Choice = string | { name: string; value: unknown }

interface Question {
  type: string
  name: string
  message: string
  choices?: Choice[]
}

const { askedQuestions, exitCalls, logMessages, mockPrompt, mockTrack, promptAnswers } = vi.hoisted(() => ({
  askedQuestions: [] as Question[],
  exitCalls: [] as number[],
  logMessages: [] as string[],
  mockPrompt: vi.fn(),
  mockTrack: vi.fn(),
  promptAnswers: new Map<string, unknown>(),
}))

vi.mock('inquirer', () => ({
  default: { prompt: mockPrompt, registerPrompt: vi.fn() },
}))

vi.mock('../../../../src/utils/scripted-commands.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../src/utils/scripted-commands.js')>()),
  isInteractive: () => true,
}))

vi.mock('../../../../src/utils/command-helpers.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../src/utils/command-helpers.js')>()),
  log: (...args: string[]) => {
    logMessages.push(args.join(' '))
  },
  exit: (code = 0) => {
    exitCalls.push(code)
    throw new Error(`process.exit(${code.toString()})`)
  },
}))

vi.mock('../../../../src/utils/telemetry/telemetry.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../src/utils/telemetry/telemetry.js')>()),
  track: mockTrack,
}))

// `logAndThrowError` fire-and-forgets this, and the real one spawns a reporting child process.
vi.mock('../../../../src/utils/telemetry/report-error.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../src/utils/telemetry/report-error.js')>()),
  reportError: vi.fn(),
}))

// Answers are looked up by inquirer question `name`. List answers are given as the choice label the
// user would pick, and resolve to that choice's `value` like inquirer does.
const answerFor = (question: Question): unknown => {
  if (!promptAnswers.has(question.name)) {
    throw new Error(`Unexpected prompt '${question.name}' ("${question.message}") with no answer queued`)
  }
  const answer = promptAnswers.get(question.name)
  promptAnswers.delete(question.name)

  if (question.type !== 'list') {
    return answer
  }
  const choice = (question.choices ?? []).find((item) => (typeof item === 'string' ? item : item.name) === answer)
  if (choice === undefined) {
    throw new Error(`Prompt '${question.name}' did not offer a choice labelled '${String(answer)}'`)
  }
  return typeof choice === 'string' ? choice : choice.value
}

mockPrompt.mockImplementation((questions: Question | Question[]) => {
  const list = Array.isArray(questions) ? questions : [questions]
  askedQuestions.push(...list)
  return Promise.resolve().then(() => Object.fromEntries(list.map((question) => [question.name, answerFor(question)])))
})

const setPromptAnswers = (answers: Record<string, unknown>) => {
  promptAnswers.clear()
  for (const [name, answer] of Object.entries(answers)) {
    promptAnswers.set(name, answer)
  }
}

const promptNames = () => askedQuestions.map((question) => question.name)

const offeredChoices = (name: string) =>
  askedQuestions
    .find((question) => question.name === name)
    ?.choices?.map((choice) => (typeof choice === 'string' ? choice : choice.name))

const output = () => stripAnsi(logMessages.join('\n'))

const LINK_BY_NAME = 'Search by full or partial project name'
const LINK_FROM_LIST = 'Choose from a list of your recently updated projects'
const LINK_BY_ID = 'Enter a project ID'
const REPO_URL = 'https://github.com/owner/repo'
const LINK_BY_GIT_REMOTE = `Use current git remote origin (${REPO_URL})`

const makeSite = (name: string, repoUrl?: string) => ({
  id: `${name}-id`,
  name,
  ssl_url: `https://${name}.netlify.app`,
  admin_url: `https://app.netlify.com/projects/${name}`,
  build_settings: repoUrl === undefined ? {} : { repo_url: repoUrl },
})

type Site = ReturnType<typeof makeSite>

const routesWithSites = (sites: Site[], extra: Route[] = []): Route[] => [
  { path: 'accounts', response: [{ slug: 'test-account' }] },
  { path: 'sites', response: sites },
  ...extra,
]

const NETLIFY_ENV_KEYS = ['NETLIFY_AUTH_TOKEN', 'NETLIFY_SITE_ID', 'NETLIFY_API_URL']
// The base command defaults `--http-proxy` from these, which would put a proxy agent between the
// in-process API client and the local mock API.
const PROXY_ENV_KEYS = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy']
const MANAGED_ENV_KEYS = [...NETLIFY_ENV_KEYS, ...PROXY_ENV_KEYS]
let savedEnv: Record<string, string | undefined> = {}

const useMockApi = (apiUrl: string) => {
  Object.assign(process.env, getEnvironmentVariables({ apiUrl }), { NETLIFY_SITE_ID: '' })
  for (const key of PROXY_ENV_KEYS) {
    Reflect.deleteProperty(process.env, key)
  }
}

// The base command derives the repository root from `process.cwd()` rather than `--cwd`, and
// framework detection never finishes when the working directory lies outside that root. Worker
// threads cannot `chdir`, so point `cwd` at the fixture for the duration of the command.
const runLink = async (directory: string) => {
  const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(directory)
  try {
    const program = new BaseCommand('netlify')
    createLinkCommand(program)
    await program.parseAsync(['', '', 'link', '--cwd', directory])
  } finally {
    cwdSpy.mockRestore()
  }
}

const readLinkedSiteId = async (directory: string): Promise<string | undefined> => {
  try {
    const state = JSON.parse(await readFile(join(directory, '.netlify', 'state.json'), 'utf8')) as { siteId?: string }
    return state.siteId
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}

const getRequests = (requests: MockApiTestContext['requests'], path: string) =>
  requests.filter((request) => request.method === 'GET' && request.path === `/api/v1/${path}`)

const expectLinkedTo = async (directory: string, site: Site, kind: string) => {
  expect(await readLinkedSiteId(directory)).toBe(site.id)
  expect(output()).toContain('Directory Linked')
  expect(output()).toContain(`Admin url: ${site.admin_url}`)
  expect(output()).toContain(site.ssl_url)
  expect(mockTrack).toHaveBeenCalledTimes(1)
  expect(mockTrack).toHaveBeenCalledWith('sites_linked', { siteId: site.id, linkType: 'prompt', kind })
}

const expectNotLinked = async (directory: string) => {
  expect(await readLinkedSiteId(directory)).toBeUndefined()
  expect(output()).not.toContain('Directory Linked')
  expect(mockTrack).not.toHaveBeenCalled()
}

describe('link command interactive prompts', () => {
  beforeEach(() => {
    savedEnv = Object.fromEntries(MANAGED_ENV_KEYS.map((key) => [key, process.env[key]]))
    askedQuestions.length = 0
    exitCalls.length = 0
    logMessages.length = 0
    promptAnswers.clear()
    mockTrack.mockClear()
  })

  afterEach(() => {
    for (const key of MANAGED_ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        Reflect.deleteProperty(process.env, key)
      } else {
        process.env[key] = savedEnv[key]
      }
    }
  })

  describe('by project ID', () => {
    test('links to the project fetched by the entered ID', async (t) => {
      const site = makeSite('by-id')
      const routes = routesWithSites([], [{ path: `sites/${site.id}`, response: site }])

      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(routes, async ({ apiUrl, requests }) => {
          useMockApi(apiUrl)
          setPromptAnswers({ linkType: LINK_BY_ID, siteId: site.id })

          await runLink(builder.directory)

          expect(promptNames()).toEqual(['linkType', 'siteId'])
          expect(offeredChoices('linkType')).toEqual([LINK_BY_NAME, LINK_FROM_LIST, LINK_BY_ID])
          expect(getRequests(requests, `sites/${site.id}`)).toHaveLength(1)
          expect(getRequests(requests, 'sites')).toHaveLength(0)
          await expectLinkedTo(builder.directory, site, 'bySiteId')
        })
      })
    })

    test('fails without linking when no project has the entered ID', async (t) => {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(
          routesWithSites([]),
          async ({ apiUrl, requests }) => {
            useMockApi(apiUrl)
            setPromptAnswers({ linkType: LINK_BY_ID, siteId: 'missing-id' })

            await expect(runLink(builder.directory)).rejects.toThrow("Project ID 'missing-id' not found")

            expect(getRequests(requests, 'sites/missing-id')).toHaveLength(1)
            await expectNotLinked(builder.directory)
          },
          true,
        )
      })
    })
  })

  describe('by project name', () => {
    test('links the project the user picks when several match the search term', async (t) => {
      const sites = [makeSite('unicorn-prod'), makeSite('unicorn-staging')]

      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(routesWithSites(sites), async ({ apiUrl, requests }) => {
          useMockApi(apiUrl)
          setPromptAnswers({ linkType: LINK_BY_NAME, searchTerm: 'unicorn', selectedSite: 'unicorn-staging' })

          await runLink(builder.directory)

          expect(promptNames()).toEqual(['linkType', 'searchTerm', 'selectedSite'])
          expect(offeredChoices('selectedSite')).toEqual(['unicorn-prod', 'unicorn-staging'])
          expect(output()).toContain("Looking for projects with names containing 'unicorn'")
          expect(output()).toContain('Found 2 matching projects!')
          expect(getRequests(requests, 'sites')).toMatchObject([{ query: { name: 'unicorn', filter: 'all' } }])
          await expectLinkedTo(builder.directory, sites[1], 'byName')
        })
      })
    })

    test('links the single match without asking the user to pick', async (t) => {
      const site = makeSite('unicorn-prod')

      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(routesWithSites([site]), async ({ apiUrl, requests }) => {
          useMockApi(apiUrl)
          setPromptAnswers({ linkType: LINK_BY_NAME, searchTerm: 'unicorn' })

          await runLink(builder.directory)

          expect(promptNames()).toEqual(['linkType', 'searchTerm'])
          expect(getRequests(requests, 'sites')).toMatchObject([{ query: { name: 'unicorn', filter: 'all' } }])
          await expectLinkedTo(builder.directory, site, 'byName')
        })
      })
    })

    test('fails without linking when nothing matches the search term', async (t) => {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(routesWithSites([]), async ({ apiUrl, requests }) => {
          useMockApi(apiUrl)
          setPromptAnswers({ linkType: LINK_BY_NAME, searchTerm: 'nothing-here' })

          await expect(runLink(builder.directory)).rejects.toThrow("No project names found containing 'nothing-here'")

          expect(promptNames()).toEqual(['linkType', 'searchTerm'])
          expect(getRequests(requests, 'sites')).toMatchObject([{ query: { name: 'nothing-here', filter: 'all' } }])
          await expectNotLinked(builder.directory)
        })
      })
    })
  })

  describe('from a list of recently updated projects', () => {
    test('links the project the user picks from the list', async (t) => {
      const sites = [makeSite('first-site'), makeSite('second-site'), makeSite('third-site')]

      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(routesWithSites(sites), async ({ apiUrl, requests }) => {
          useMockApi(apiUrl)
          setPromptAnswers({ linkType: LINK_FROM_LIST, selectedSite: 'second-site' })

          await runLink(builder.directory)

          expect(promptNames()).toEqual(['linkType', 'selectedSite'])
          expect(offeredChoices('selectedSite')).toEqual(['first-site', 'second-site', 'third-site'])
          expect(output()).toContain('Fetching recently updated projects...')
          expect(getRequests(requests, 'sites')).toHaveLength(1)
          await expectLinkedTo(builder.directory, sites[1], 'fromList')
        })
      })
    })

    test('fails without linking when the account has no projects', async (t) => {
      await withSiteBuilder(t, async (builder) => {
        await builder.build()

        await withMockApi(routesWithSites([]), async ({ apiUrl }) => {
          useMockApi(apiUrl)
          setPromptAnswers({ linkType: LINK_FROM_LIST })

          await expect(runLink(builder.directory)).rejects.toThrow("You don't have any projects yet")

          expect(promptNames()).toEqual(['linkType'])
          await expectNotLinked(builder.directory)
        })
      })
    })
  })

  describe('by git remote origin', () => {
    const unrelatedSite = makeSite('unrelated', 'https://github.com/someone/else')

    test('offers the remote first and links the project the user picks when several are connected to it', async (t) => {
      const connected = [makeSite('repo-prod', REPO_URL), makeSite('repo-preview', REPO_URL)]

      await withSiteBuilder(t, async (builder) => {
        await builder.withGit({ repoUrl: 'git@github.com:owner/repo.git' }).build()

        await withMockApi(
          routesWithSites([connected[0], unrelatedSite, connected[1]]),
          async ({ apiUrl, requests }) => {
            useMockApi(apiUrl)
            setPromptAnswers({
              linkType: LINK_BY_GIT_REMOTE,
              selectedSite: `${connected[1].name} - ${connected[1].ssl_url}`,
            })

            await runLink(builder.directory)

            expect(promptNames()).toEqual(['linkType', 'selectedSite'])
            expect(offeredChoices('linkType')).toEqual([LINK_BY_GIT_REMOTE, LINK_BY_NAME, LINK_FROM_LIST, LINK_BY_ID])
            expect(offeredChoices('selectedSite')).toEqual([
              `${connected[0].name} - ${connected[0].ssl_url}`,
              `${connected[1].name} - ${connected[1].ssl_url}`,
            ])
            expect(getRequests(requests, 'sites')).toHaveLength(1)
            await expectLinkedTo(builder.directory, connected[1], 'gitRemote')
          },
        )
      })
    })

    test('links the single connected project without asking the user to pick', async (t) => {
      const connected = makeSite('repo-prod', REPO_URL)

      await withSiteBuilder(t, async (builder) => {
        await builder.withGit({ repoUrl: 'git@github.com:owner/repo.git' }).build()

        await withMockApi(routesWithSites([unrelatedSite, connected]), async ({ apiUrl, requests }) => {
          useMockApi(apiUrl)
          setPromptAnswers({ linkType: LINK_BY_GIT_REMOTE })

          await runLink(builder.directory)

          expect(promptNames()).toEqual(['linkType'])
          expect(getRequests(requests, 'sites')).toHaveLength(1)
          await expectLinkedTo(builder.directory, connected, 'gitRemote')
        })
      })
    })

    test('prints guidance and exits with 1 when no project is connected to the remote', async (t) => {
      await withSiteBuilder(t, async (builder) => {
        await builder.withGit({ repoUrl: 'git@github.com:owner/repo.git' }).build()

        await withMockApi(routesWithSites([unrelatedSite]), async ({ apiUrl }) => {
          useMockApi(apiUrl)
          setPromptAnswers({ linkType: LINK_BY_GIT_REMOTE })

          await expect(runLink(builder.directory)).rejects.toThrow('process.exit(1)')

          expect(exitCalls).toEqual([1])
          expect(promptNames()).toEqual(['linkType'])
          expect(output()).toContain('No matching project found')
          expect(output()).toContain(`No project found with the remote ${REPO_URL}`)
          expect(output()).toContain('link --id <project-id>')
          await expectNotLinked(builder.directory)
        })
      })
    })
  })
})
