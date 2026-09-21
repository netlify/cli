import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import stripAnsi from 'strip-ansi'

import BaseCommand from '../../../../src/commands/base-command.js'
import { createLinkCommand } from '../../../../src/commands/link/index.js'
import { getEnvironmentVariables, withMockApi, type MockApiTestContext, type Route } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.js'

interface AskedOption {
  value: unknown
  label?: string | undefined
  hint?: string | undefined
}

interface SelectQuestion {
  message: string
  options: AskedOption[]
}

interface TextQuestion {
  message: string
}

interface AskedPrompt {
  type: 'select' | 'text'
  message: string
  options?: AskedOption[]
}

const { askedPrompts, exitCalls, logMessages, mockPromptSelect, mockPromptText, mockTrack, promptAnswers } = vi.hoisted(
  () => ({
    askedPrompts: [] as AskedPrompt[],
    exitCalls: [] as number[],
    logMessages: [] as string[],
    mockPromptSelect: vi.fn<(question: SelectQuestion) => Promise<unknown>>(),
    mockPromptText: vi.fn<(question: TextQuestion) => Promise<string>>(),
    mockTrack: vi.fn(),
    promptAnswers: [] as unknown[],
  }),
)

vi.mock('../../../../src/utils/prompts/index.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../src/utils/prompts/index.js')>()),
  intro: vi.fn(),
  outro: vi.fn(),
  promptSelect: (question: SelectQuestion) => mockPromptSelect(question),
  promptText: (question: TextQuestion) => mockPromptText(question),
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

const optionLabel = (option: AskedOption): string => option.label ?? String(option.value)

// Answers are consumed in the order the prompts are asked. Select answers are given as the option label the
// user would pick, and resolve to that option's `value` like the real prompt does.
const nextAnswer = (message: string): unknown => {
  if (promptAnswers.length === 0) {
    throw new Error(`Unexpected prompt "${message}" with no answer queued`)
  }
  return promptAnswers.shift()
}

mockPromptSelect.mockImplementation((question) => {
  askedPrompts.push({ type: 'select', message: question.message, options: question.options })
  return Promise.resolve().then(() => {
    const answer = nextAnswer(question.message)
    const option = question.options.find((item) => optionLabel(item) === answer)
    if (option === undefined) {
      throw new Error(`Prompt "${question.message}" did not offer a choice labelled '${String(answer)}'`)
    }
    return option.value
  })
})

mockPromptText.mockImplementation((question) => {
  askedPrompts.push({ type: 'text', message: question.message })
  return Promise.resolve().then(() => String(nextAnswer(question.message)))
})

const queuePromptAnswers = (...answers: unknown[]) => {
  promptAnswers.length = 0
  promptAnswers.push(...answers)
}

const askedMessages = () => askedPrompts.map((prompt) => prompt.message)

const offeredOptions = (message: string) => askedPrompts.find((prompt) => prompt.message === message)?.options

const offeredChoices = (message: string) => offeredOptions(message)?.map(optionLabel)

const offeredHints = (message: string) => offeredOptions(message)?.map((option) => option.hint)

const output = () => stripAnsi(logMessages.join('\n'))

const HOW_TO_LINK = 'How do you want to link this folder to a project?'
const WHICH_PROJECT = 'Which project do you want to link?'
const SEARCH_TERM = 'Enter the project name (or just part of it):'
const PROJECT_ID = 'What is the project ID?'

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
    askedPrompts.length = 0
    exitCalls.length = 0
    logMessages.length = 0
    promptAnswers.length = 0
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
          queuePromptAnswers(LINK_BY_ID, site.id)

          await runLink(builder.directory)

          expect(askedMessages()).toEqual([HOW_TO_LINK, PROJECT_ID])
          expect(offeredChoices(HOW_TO_LINK)).toEqual([LINK_BY_NAME, LINK_FROM_LIST, LINK_BY_ID])
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
            queuePromptAnswers(LINK_BY_ID, 'missing-id')

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
          queuePromptAnswers(LINK_BY_NAME, 'unicorn', 'unicorn-staging')

          await runLink(builder.directory)

          expect(askedMessages()).toEqual([HOW_TO_LINK, SEARCH_TERM, WHICH_PROJECT])
          expect(offeredChoices(WHICH_PROJECT)).toEqual(['unicorn-prod', 'unicorn-staging'])
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
          queuePromptAnswers(LINK_BY_NAME, 'unicorn')

          await runLink(builder.directory)

          expect(askedMessages()).toEqual([HOW_TO_LINK, SEARCH_TERM])
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
          queuePromptAnswers(LINK_BY_NAME, 'nothing-here')

          await expect(runLink(builder.directory)).rejects.toThrow("No project names found containing 'nothing-here'")

          expect(askedMessages()).toEqual([HOW_TO_LINK, SEARCH_TERM])
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
          queuePromptAnswers(LINK_FROM_LIST, 'second-site')

          await runLink(builder.directory)

          expect(askedMessages()).toEqual([HOW_TO_LINK, WHICH_PROJECT])
          expect(offeredChoices(WHICH_PROJECT)).toEqual(['first-site', 'second-site', 'third-site'])
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
          queuePromptAnswers(LINK_FROM_LIST)

          await expect(runLink(builder.directory)).rejects.toThrow("You don't have any projects yet")

          expect(askedMessages()).toEqual([HOW_TO_LINK])
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
            queuePromptAnswers(LINK_BY_GIT_REMOTE, connected[1].name)

            await runLink(builder.directory)

            expect(askedMessages()).toEqual([HOW_TO_LINK, WHICH_PROJECT])
            expect(offeredChoices(HOW_TO_LINK)).toEqual([LINK_BY_GIT_REMOTE, LINK_BY_NAME, LINK_FROM_LIST, LINK_BY_ID])
            expect(offeredChoices(WHICH_PROJECT)).toEqual([connected[0].name, connected[1].name])
            expect(offeredHints(WHICH_PROJECT)).toEqual([connected[0].ssl_url, connected[1].ssl_url])
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
          queuePromptAnswers(LINK_BY_GIT_REMOTE)

          await runLink(builder.directory)

          expect(askedMessages()).toEqual([HOW_TO_LINK])
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
          queuePromptAnswers(LINK_BY_GIT_REMOTE)

          await expect(runLink(builder.directory)).rejects.toThrow('process.exit(1)')

          expect(exitCalls).toEqual([1])
          expect(askedMessages()).toEqual([HOW_TO_LINK])
          expect(output()).toContain('No matching project found')
          expect(output()).toContain(`No project found with the remote ${REPO_URL}`)
          expect(output()).toContain('link --id <project-id>')
          await expectNotLinked(builder.directory)
        })
      })
    })
  })
})
