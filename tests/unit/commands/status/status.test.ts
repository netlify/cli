import { describe, expect, test, vi, beforeEach } from 'vitest'

const { mockGetToken, mockGetCurrentUser, logMessages, jsonMessages, exitCalls } = vi.hoisted(() => {
  const mockGetToken = vi.fn()
  const mockGetCurrentUser = vi.fn()
  const logMessages: string[] = []
  const jsonMessages: unknown[] = []
  const exitCalls: number[] = []
  return { mockGetToken, mockGetCurrentUser, logMessages, jsonMessages, exitCalls }
})

vi.mock('../../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../../src/utils/command-helpers.js')),
  getToken: (...args: unknown[]) => mockGetToken(...args),
  log: (...args: string[]) => {
    logMessages.push(args.join(' '))
  },
  logJson: (message: unknown) => {
    jsonMessages.push(message)
  },
  warn: (message: string) => {
    logMessages.push(message)
  },
  logAndThrowError: (message: unknown): never => {
    throw message instanceof Error ? message : new Error(String(message))
  },
  exit: (code = 0): never => {
    exitCalls.push(code)
    throw new Error(`exit(${String(code)})`)
  },
}))

import { status, STATUS_ERROR_CODES } from '../../../../src/commands/status/status.js'

function createMockCommand(overrides: { siteId?: string } = {}) {
  const { siteId } = overrides

  return {
    netlify: {
      accounts: [{ name: 'My Team' }],
      api: {
        getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
      },
      globalConfig: {
        get: vi.fn().mockReturnValue(undefined),
      },
      site: { id: siteId, configPath: '/project/netlify.toml' },
      siteInfo: {
        id: siteId,
        name: 'my-site',
        admin_url: 'https://app.netlify.com/sites/my-site',
        ssl_url: 'https://my-site.netlify.app',
        url: 'http://my-site.netlify.app',
      },
    },
  } as unknown as Parameters<typeof status>[1]
}

describe('status', () => {
  beforeEach(() => {
    logMessages.length = 0
    jsonMessages.length = 0
    exitCalls.length = 0
    vi.clearAllMocks()
    mockGetToken.mockResolvedValue(['fake-token', 'config'])
    mockGetCurrentUser.mockResolvedValue({ full_name: 'Test User', email: 'test@example.com' })
  })

  describe('not logged in', () => {
    beforeEach(() => {
      mockGetToken.mockResolvedValue([null, 'not found'])
    })

    test('with --json emits a NOT_LOGGED_IN error envelope and exits non-zero', async () => {
      await expect(status({ json: true }, createMockCommand())).rejects.toThrow('exit(1)')

      expect(jsonMessages).toHaveLength(1)
      expect(jsonMessages[0]).toEqual({
        loggedIn: false,
        linked: false,
        account: null,
        siteData: null,
        error: {
          code: STATUS_ERROR_CODES.NOT_LOGGED_IN,
          fix: 'netlify login or NETLIFY_AUTH_TOKEN',
        },
      })
      expect(exitCalls).toEqual([1])
    })

    test('without --json keeps existing behavior: human message and exit 0', async () => {
      await expect(status({}, createMockCommand())).rejects.toThrow('exit(0)')

      expect(jsonMessages).toHaveLength(0)
      expect(exitCalls).toEqual([0])
      expect(logMessages.join('\n')).toContain('Not logged in')
    })
  })

  describe('logged in but not linked', () => {
    test('with --json emits a NOT_LINKED error envelope including account data', async () => {
      await expect(status({ json: true }, createMockCommand())).rejects.toThrow(
        "You don't appear to be in a folder that is linked to a project",
      )

      expect(jsonMessages).toHaveLength(1)
      expect(jsonMessages[0]).toEqual({
        loggedIn: true,
        linked: false,
        account: {
          Name: 'Test User',
          Email: 'test@example.com',
          Teams: ['My Team'],
        },
        siteData: null,
        error: {
          code: STATUS_ERROR_CODES.NOT_LINKED,
          fix: 'netlify link',
        },
      })
    })

    test('without --json keeps existing behavior: warns and throws without JSON output', async () => {
      await expect(status({}, createMockCommand())).rejects.toThrow(
        "You don't appear to be in a folder that is linked to a project",
      )

      expect(jsonMessages).toHaveLength(0)
      expect(logMessages.join('\n')).toContain('Did you run `netlify link` yet?')
    })
  })

  describe('logged in and linked', () => {
    test('with --json keeps existing keys and adds loggedIn, linked, and error', async () => {
      await status({ json: true }, createMockCommand({ siteId: 'site-123' }))

      expect(jsonMessages).toHaveLength(1)
      expect(jsonMessages[0]).toEqual({
        account: {
          Name: 'Test User',
          Email: 'test@example.com',
          Teams: ['My Team'],
        },
        siteData: {
          'site-name': 'my-site',
          'config-path': '/project/netlify.toml',
          'admin-url': 'https://app.netlify.com/sites/my-site',
          'site-url': 'https://my-site.netlify.app',
          'site-id': 'site-123',
        },
        loggedIn: true,
        linked: true,
        error: null,
      })
      expect(exitCalls).toHaveLength(0)
    })

    test('without --json does not emit JSON', async () => {
      await status({}, createMockCommand({ siteId: 'site-123' }))

      expect(jsonMessages).toHaveLength(0)
    })
  })

  describe('expired session', () => {
    beforeEach(() => {
      mockGetCurrentUser.mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }))
    })

    test('with --json emits a NOT_LOGGED_IN error envelope before throwing', async () => {
      await expect(status({ json: true }, createMockCommand())).rejects.toThrow('Your session has expired')

      expect(jsonMessages).toHaveLength(1)
      expect(jsonMessages[0]).toMatchObject({
        loggedIn: false,
        error: { code: STATUS_ERROR_CODES.NOT_LOGGED_IN },
      })
    })

    test('without --json keeps existing behavior: throws without JSON output', async () => {
      await expect(status({}, createMockCommand())).rejects.toThrow('Your session has expired')

      expect(jsonMessages).toHaveLength(0)
    })
  })
})
