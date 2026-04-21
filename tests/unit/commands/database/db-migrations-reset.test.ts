import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'

const { mockCleanup, mockExecutor, mockQuery, mockReaddir, mockRm, mockFetch, logMessages, jsonMessages } = vi.hoisted(
  () => {
    const mockCleanup = vi.fn().mockResolvedValue(undefined)
    const mockQuery = vi.fn()
    const mockExecutor = { query: mockQuery }
    const mockReaddir = vi.fn()
    const mockRm = vi.fn().mockResolvedValue(undefined)
    const mockFetch = vi.fn()
    const logMessages: string[] = []
    const jsonMessages: unknown[] = []
    return { mockCleanup, mockExecutor, mockQuery, mockReaddir, mockRm, mockFetch, logMessages, jsonMessages }
  },
)

vi.mock('../../../../src/commands/database/util/db-connection.js', () => ({
  connectToDatabase: vi.fn().mockImplementation(() =>
    Promise.resolve({
      executor: mockExecutor,
      cleanup: mockCleanup,
    }),
  ),
}))

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>()
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    readdir: (...args: unknown[]) => mockReaddir(...args),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    rm: (...args: unknown[]) => mockRm(...args),
  }
})

vi.mock('../../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../../src/utils/command-helpers.js')),
  log: (...args: string[]) => {
    logMessages.push(args.join(' '))
  },
  logJson: (message: unknown) => {
    jsonMessages.push(message)
  },
}))

vi.stubGlobal('fetch', mockFetch)

import { migrationsReset } from '../../../../src/commands/database/db-migrations-reset.js'

const makeDirents = (specs: { name: string; type?: 'directory' | 'file' }[]) =>
  specs.map(({ name, type = 'directory' }) => ({
    name,
    isDirectory: () => type === 'directory',
    isFile: () => type === 'file',
  }))

function mockLocalAppliedRows(names: string[]) {
  mockQuery.mockResolvedValue({ rows: names.map((name) => ({ name })) })
}

function createMockCommand(
  overrides: { buildDir?: string; projectRoot?: string; siteId?: string | null; accessToken?: string | null } = {},
) {
  const { buildDir = '/project', projectRoot = '/project' } = overrides
  const siteId = overrides.siteId === null ? undefined : overrides.siteId ?? 'site-123'
  const accessToken = overrides.accessToken === null ? undefined : overrides.accessToken ?? 'Bearer test-token'

  return {
    siteId,
    project: { root: projectRoot, baseDirectory: undefined },
    netlify: {
      site: { root: buildDir, id: siteId },
      config: {},
      api: {
        accessToken,
        basePath: 'https://api.netlify.com/api/v1',
      },
    },
  } as unknown as Parameters<typeof migrationsReset>[1]
}

describe('migrationsReset', () => {
  beforeEach(() => {
    logMessages.length = 0
    jsonMessages.length = 0
    vi.clearAllMocks()
    mockCleanup.mockResolvedValue(undefined)
    mockRm.mockResolvedValue(undefined)
    mockReaddir.mockResolvedValue([])
    mockLocalAppliedRows([])
    delete process.env.NETLIFY_DB_BRANCH
  })

  afterEach(() => {
    delete process.env.NETLIFY_DB_BRANCH
  })

  describe('local (no --branch, no env)', () => {
    test('deletes only pending migration subdirectories; leaves applied untouched', async () => {
      mockLocalAppliedRows(['0001_a', '0002_b'])
      mockReaddir.mockResolvedValue(
        makeDirents([{ name: '0001_a' }, { name: '0002_b' }, { name: '0003_c' }, { name: '0004_d' }]),
      )

      await migrationsReset({}, createMockCommand())

      const rmPaths = mockRm.mock.calls.map((c) => c[0] as string)
      expect(rmPaths).toEqual([
        '/project/netlify/database/migrations/0003_c',
        '/project/netlify/database/migrations/0004_d',
      ])
      expect(mockRm.mock.calls[0][1]).toEqual({ recursive: true, force: true })
      expect(mockFetch).not.toHaveBeenCalled()
    })

    test('handles flat `.sql` migrations alongside directories', async () => {
      mockLocalAppliedRows([])
      mockReaddir.mockResolvedValue(
        makeDirents([
          { name: '0001_a', type: 'directory' },
          { name: '0002_b.sql', type: 'file' },
        ]),
      )

      await migrationsReset({}, createMockCommand())

      const rmPaths = mockRm.mock.calls.map((c) => c[0] as string)
      expect(rmPaths).toEqual([
        '/project/netlify/database/migrations/0001_a',
        '/project/netlify/database/migrations/0002_b.sql',
      ])
    })

    test('is a no-op when there are no pending migrations', async () => {
      mockLocalAppliedRows(['0001_a'])
      mockReaddir.mockResolvedValue(makeDirents([{ name: '0001_a' }]))

      await migrationsReset({}, createMockCommand())

      expect(mockRm).not.toHaveBeenCalled()
      expect(logMessages.join('\n')).toContain('No pending migration files to delete')
    })

    test('logs a before + after summary', async () => {
      mockLocalAppliedRows(['0001_a'])
      mockReaddir.mockResolvedValue(makeDirents([{ name: '0001_a' }, { name: '0002_b' }]))

      await migrationsReset({}, createMockCommand())

      const output = logMessages.join('\n')
      expect(output).toContain(
        'Removing local migration files that have not been applied to the local development database',
      )
      expect(output).toContain('Deleted 1 pending migration file(s)')
      expect(output).toContain('0002_b')
    })

    test('outputs JSON when --json is set', async () => {
      mockLocalAppliedRows(['0001_a'])
      mockReaddir.mockResolvedValue(makeDirents([{ name: '0001_a' }, { name: '0002_b' }]))

      await migrationsReset({ json: true }, createMockCommand())

      expect(logMessages).toHaveLength(0)
      expect(jsonMessages).toHaveLength(1)
      expect(jsonMessages[0]).toEqual({
        reset: true,
        target: 'local',
        pendingMigrationFilesDeleted: ['0002_b'],
      })
    })

    test('calls cleanup even when something downstream fails', async () => {
      mockReaddir.mockRejectedValueOnce(new Error('boom'))

      await expect(migrationsReset({}, createMockCommand())).rejects.toThrow('boom')
      expect(mockCleanup).toHaveBeenCalledOnce()
    })

    test('throws when project root cannot be determined', async () => {
      const command = {
        project: { root: undefined, baseDirectory: undefined },
        netlify: { site: { root: undefined }, config: {}, api: {} },
      } as unknown as Parameters<typeof migrationsReset>[1]

      await expect(migrationsReset({}, command)).rejects.toThrow('Could not determine the project root directory.')
    })
  })

  describe('remote branch (--branch / NETLIFY_DB_BRANCH)', () => {
    function mockBranchAppliedResponse(names: string[]) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            migrations: names.map((name, i) => ({
              version: i + 1,
              name,
              path: `${name}/migration.sql`,
              applied: true,
            })),
          }),
      })
    }

    test('fetches branch applied list and deletes local files not in it', async () => {
      mockBranchAppliedResponse(['0001_a'])
      mockReaddir.mockResolvedValue(makeDirents([{ name: '0001_a' }, { name: '0002_b' }, { name: '0003_c' }]))

      await migrationsReset({ branch: 'feature-x' }, createMockCommand())

      const fetchUrl = (mockFetch.mock.calls[0][0] as URL | string).toString()
      expect(fetchUrl).toContain('/database/migrations')
      expect(fetchUrl).toContain('branch=feature-x')

      const rmPaths = mockRm.mock.calls.map((c) => c[0] as string)
      expect(rmPaths).toEqual([
        '/project/netlify/database/migrations/0002_b',
        '/project/netlify/database/migrations/0003_c',
      ])
      // Does NOT connect to the local DB.
      expect(mockCleanup).not.toHaveBeenCalled()
    })

    test('logs before and after messages naming the branch', async () => {
      mockBranchAppliedResponse(['0001_a'])
      mockReaddir.mockResolvedValue(makeDirents([{ name: '0001_a' }, { name: '0002_b' }]))

      await migrationsReset({ branch: 'feature-x' }, createMockCommand())

      const output = logMessages.join('\n')
      expect(output).toContain('not been applied to database branch')
      expect(output).toContain('feature-x')
      expect(output).toContain('Deleted 1 pending migration file(s)')
      expect(output).toContain('0002_b')
    })

    test('no-op when nothing is pending', async () => {
      mockBranchAppliedResponse(['0001_a'])
      mockReaddir.mockResolvedValue(makeDirents([{ name: '0001_a' }]))

      await migrationsReset({ branch: 'feature-x' }, createMockCommand())

      expect(mockRm).not.toHaveBeenCalled()
      expect(logMessages.join('\n')).toContain('No pending migration files to delete')
    })

    test('JSON output shape for remote', async () => {
      mockBranchAppliedResponse([])
      mockReaddir.mockResolvedValue(makeDirents([{ name: '0001_a' }]))

      await migrationsReset({ branch: 'feature-x', json: true }, createMockCommand())

      expect(logMessages).toHaveLength(0)
      expect(jsonMessages[0]).toEqual({
        reset: true,
        target: 'branch',
        branch: 'feature-x',
        pendingMigrationFilesDeleted: ['0001_a'],
      })
    })

    test('requires linked project', async () => {
      await expect(migrationsReset({ branch: 'feature-x' }, createMockCommand({ siteId: null }))).rejects.toThrow(
        'project must be linked',
      )
    })

    test('requires login', async () => {
      await expect(migrationsReset({ branch: 'feature-x' }, createMockCommand({ accessToken: null }))).rejects.toThrow(
        'must be logged in',
      )
    })

    test('surfaces API errors when fetching applied list fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('boom'),
      })

      await expect(migrationsReset({ branch: 'feature-x' }, createMockCommand())).rejects.toThrow(
        'Failed to fetch applied migrations (500)',
      )
    })

    test('falls back to NETLIFY_DB_BRANCH env var when --branch is not passed', async () => {
      process.env.NETLIFY_DB_BRANCH = 'feature-env'
      mockBranchAppliedResponse([])
      mockReaddir.mockResolvedValue(makeDirents([{ name: '0001_a' }]))

      await migrationsReset({ json: true }, createMockCommand())

      const fetchUrl = (mockFetch.mock.calls[0][0] as URL | string).toString()
      expect(fetchUrl).toContain('branch=feature-env')
      expect(jsonMessages[0]).toMatchObject({ target: 'branch', branch: 'feature-env' })
      expect(mockCleanup).not.toHaveBeenCalled()
    })

    test('--branch wins over NETLIFY_DB_BRANCH when both are set', async () => {
      process.env.NETLIFY_DB_BRANCH = 'env-branch'
      mockBranchAppliedResponse([])
      mockReaddir.mockResolvedValue(makeDirents([{ name: '0001_a' }]))

      await migrationsReset({ branch: 'flag-branch', json: true }, createMockCommand())

      const fetchUrl = (mockFetch.mock.calls[0][0] as URL | string).toString()
      expect(fetchUrl).toContain('branch=flag-branch')
      expect(jsonMessages[0]).toMatchObject({ target: 'branch', branch: 'flag-branch' })
    })
  })
})
