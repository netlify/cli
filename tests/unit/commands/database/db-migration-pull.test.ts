import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'

const { mockRm, mockMkdir, mockWriteFile, mockFetch, mockExeca, logMessages, jsonMessages } = vi.hoisted(() => {
  const mockRm = vi.fn().mockResolvedValue(undefined)
  const mockMkdir = vi.fn().mockResolvedValue(undefined)
  const mockWriteFile = vi.fn().mockResolvedValue(undefined)
  const mockFetch = vi.fn()
  const mockExeca = vi.fn()
  const logMessages: string[] = []
  const jsonMessages: unknown[] = []
  return { mockRm, mockMkdir, mockWriteFile, mockFetch, mockExeca, logMessages, jsonMessages }
})

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>()
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    rm: (...args: unknown[]) => mockRm(...args),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
  }
})

vi.mock('inquirer', () => ({
  default: { prompt: vi.fn() },
}))

vi.mock('../../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../../src/utils/command-helpers.js')),
  log: (...args: string[]) => {
    logMessages.push(args.join(' '))
  },
  logJson: (message: unknown) => {
    jsonMessages.push(message)
  },
}))

vi.mock('../../../../src/utils/execa.js', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  default: (...args: unknown[]) => mockExeca(...args),
}))

vi.stubGlobal('fetch', mockFetch)

import { resolve } from 'path'

import inquirer from 'inquirer'
import { migrationPull } from '../../../../src/commands/database/db-migration-pull.js'

interface SampleMigration {
  version: number
  name: string
  path: string
  content: string
  applied?: boolean
}

const sampleMigrations: SampleMigration[] = [
  {
    version: 1,
    name: '0001_create-users',
    path: '0001_create-users/migration.sql',
    content: 'CREATE TABLE users (id SERIAL PRIMARY KEY);',
  },
  {
    version: 2,
    name: '0002_add-posts',
    path: '0002_add-posts/migration.sql',
    content: 'CREATE TABLE posts (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id));',
  },
]

function createMockCommand(
  overrides: { siteId?: string | null; accessToken?: string | null; migrationsPath?: string } = {},
) {
  const siteId = overrides.siteId === null ? undefined : overrides.siteId ?? 'site-123'
  const accessToken = overrides.accessToken === null ? undefined : overrides.accessToken ?? 'Bearer test-token'
  const migrationsPath = overrides.migrationsPath ?? '/project/netlify/database/migrations'

  return {
    siteId,
    project: { root: '/project', baseDirectory: undefined },
    netlify: {
      site: { root: '/project' },
      config: migrationsPath ? { db: { migrations: { path: migrationsPath } } } : {},
      api: {
        accessToken,
        basePath: 'https://api.netlify.com/api/v1',
      },
    },
  } as unknown as Parameters<typeof migrationPull>[1]
}

function mockFetchResponse(migrations: SampleMigration[]) {
  const listItems = migrations.map(({ content: _content, applied = false, ...rest }) => ({ ...rest, applied }))
  mockFetch.mockImplementation((input: URL | string) => {
    const url = input instanceof URL ? input : new URL(input)
    const detailMatch = /\/database\/migrations\/([^/]+)$/.exec(url.pathname)
    if (detailMatch) {
      const name = decodeURIComponent(detailMatch[1])
      const migration = migrations.find((m) => m.name === name)
      if (!migration) {
        return Promise.resolve({
          ok: false,
          status: 404,
          text: () => Promise.resolve(`migration "${name}" not found`),
        })
      }
      const { applied: _applied, ...detail } = migration
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(detail),
      })
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ migrations: listItems }),
    })
  })
}

describe('migrationPull', () => {
  beforeEach(() => {
    logMessages.length = 0
    jsonMessages.length = 0
    vi.clearAllMocks()
    delete process.env.NETLIFY_DB_BRANCH
  })

  afterEach(() => {
    delete process.env.NETLIFY_DB_BRANCH
  })

  test('throws when project is not linked', async () => {
    const command = createMockCommand({ siteId: null })

    await expect(migrationPull({}, command)).rejects.toThrow('must be linked')
  })

  test('throws when not logged in', async () => {
    const command = createMockCommand({ accessToken: null })

    await expect(migrationPull({}, command)).rejects.toThrow('must be logged in')
  })

  test('fetches migrations from the correct API endpoint', async () => {
    mockFetchResponse(sampleMigrations)
    vi.mocked(inquirer.prompt).mockResolvedValueOnce({ confirmed: true })

    await migrationPull({}, createMockCommand())

    const calledUrl = mockFetch.mock.calls[0][0] as URL
    expect(calledUrl.toString()).toBe('https://api.netlify.com/api/v1/sites/site-123/database/migrations')
    expect(mockFetch.mock.calls[0][1]).toEqual({ headers: { Authorization: 'Bearer test-token' } })
  })

  test('fetches content for each migration from the detail endpoint', async () => {
    mockFetchResponse(sampleMigrations)

    await migrationPull({ force: true }, createMockCommand())

    const detailCalls = mockFetch.mock.calls
      .map((call) => call[0] as URL)
      .filter((url) => /\/database\/migrations\/[^/]+$/.test(url.pathname))

    expect(detailCalls).toHaveLength(2)
    expect(detailCalls.map((u) => u.toString()).sort()).toEqual([
      'https://api.netlify.com/api/v1/sites/site-123/database/migrations/0001_create-users',
      'https://api.netlify.com/api/v1/sites/site-123/database/migrations/0002_add-posts',
    ])
    for (const call of mockFetch.mock.calls) {
      expect(call[1]).toEqual({ headers: { Authorization: 'Bearer test-token' } })
    }
  })

  test('forwards branch to both list and detail endpoints', async () => {
    mockFetchResponse(sampleMigrations)

    await migrationPull({ branch: 'staging', force: true }, createMockCommand())

    for (const call of mockFetch.mock.calls) {
      const url = call[0] as URL
      expect(url.searchParams.get('branch')).toBe('staging')
    }
  })

  test('throws with migration name when content fetch fails', async () => {
    mockFetch.mockImplementation((input: URL | string) => {
      const url = input instanceof URL ? input : new URL(input)
      if (/\/database\/migrations\/[^/]+$/.test(url.pathname)) {
        return Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve('internal error'),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            migrations: [
              { version: 1, name: '0001_create-users', path: '0001_create-users/migration.sql', applied: false },
            ],
          }),
      })
    })

    await expect(migrationPull({ force: true }, createMockCommand())).rejects.toThrow(
      'Failed to fetch content for migration "0001_create-users" (500): internal error',
    )
    expect(mockRm).not.toHaveBeenCalled()
    expect(mockWriteFile).not.toHaveBeenCalled()
  })

  test('logs message and exits when no migrations exist in production', async () => {
    mockFetchResponse([])

    await migrationPull({}, createMockCommand())

    expect(logMessages[0]).toContain('No migrations found for production')
    expect(mockRm).not.toHaveBeenCalled()
  })

  test('outputs json when no migrations and --json flag is set', async () => {
    mockFetchResponse([])

    await migrationPull({ json: true }, createMockCommand())

    expect(jsonMessages[0]).toEqual({ migrations_pulled: 0, branch: 'production' })
  })

  test('prompts for confirmation before overwriting', async () => {
    mockFetchResponse(sampleMigrations)
    vi.mocked(inquirer.prompt).mockResolvedValueOnce({ confirmed: false })

    await migrationPull({}, createMockCommand())

    expect(inquirer.prompt).toHaveBeenCalledTimes(1)
    expect(mockRm).not.toHaveBeenCalled()
    expect(logMessages).toContain('Pull cancelled.')
  })

  test('skips confirmation prompt with --force', async () => {
    mockFetchResponse(sampleMigrations)

    await migrationPull({ force: true }, createMockCommand())

    expect(inquirer.prompt).not.toHaveBeenCalled()
    expect(mockRm).toHaveBeenCalled()
  })

  test('removes existing migrations directory and writes fetched migrations', async () => {
    mockFetchResponse(sampleMigrations)
    vi.mocked(inquirer.prompt).mockResolvedValueOnce({ confirmed: true })

    const migrationsPath = '/project/netlify/database/migrations'
    const resolved = resolve(migrationsPath)
    await migrationPull({}, createMockCommand({ migrationsPath }))

    expect(mockRm).toHaveBeenCalledWith(resolved, { recursive: true, force: true })

    expect(mockMkdir).toHaveBeenCalledTimes(2)
    expect(mockMkdir).toHaveBeenCalledWith(resolve(resolved, '0001_create-users'), { recursive: true })
    expect(mockMkdir).toHaveBeenCalledWith(resolve(resolved, '0002_add-posts'), { recursive: true })

    expect(mockWriteFile).toHaveBeenCalledTimes(2)
    expect(mockWriteFile).toHaveBeenCalledWith(
      resolve(resolved, '0001_create-users', 'migration.sql'),
      'CREATE TABLE users (id SERIAL PRIMARY KEY);',
    )
    expect(mockWriteFile).toHaveBeenCalledWith(
      resolve(resolved, '0002_add-posts', 'migration.sql'),
      'CREATE TABLE posts (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id));',
    )
  })

  test('logs pulled migration names', async () => {
    mockFetchResponse(sampleMigrations)
    vi.mocked(inquirer.prompt).mockResolvedValueOnce({ confirmed: true })

    await migrationPull({}, createMockCommand())

    expect(logMessages[0]).toContain('Pulled 2 migrations from production')
    expect(logMessages[1]).toContain('0001_create-users')
    expect(logMessages[2]).toContain('0002_add-posts')
  })

  test('outputs json with --json flag', async () => {
    mockFetchResponse(sampleMigrations)

    await migrationPull({ force: true, json: true }, createMockCommand())

    expect(jsonMessages[0]).toEqual({
      migrations_pulled: 2,
      branch: 'production',
      migrations: ['0001_create-users', '0002_add-posts'],
    })
  })

  test('handles single migration with correct pluralization', async () => {
    mockFetchResponse([sampleMigrations[0]])

    await migrationPull({ force: true }, createMockCommand())

    expect(logMessages[0]).toContain('Pulled 1 migration from production')
    expect(logMessages[0]).not.toContain('migrations')
  })

  test('throws on API error response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve('database not found'),
    })

    await expect(migrationPull({ force: true }, createMockCommand())).rejects.toThrow(
      'Failed to fetch migrations (404): database not found',
    )
  })

  test('extracts the server `message` from a JSON error body', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 423,
      text: () => Promise.resolve(JSON.stringify({ code: 423, message: 'database is disabled' })),
    })

    await expect(migrationPull({ force: true }, createMockCommand())).rejects.toThrow(
      'Failed to fetch migrations (423): database is disabled',
    )
  })

  test('rejects migration paths with directory traversal', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          migrations: [{ version: 1, name: 'evil', path: '../etc/passwd', content: 'malicious' }],
        }),
    })

    await expect(migrationPull({ force: true }, createMockCommand())).rejects.toThrow('invalid path segments')
    expect(mockWriteFile).not.toHaveBeenCalled()
  })

  test('rejects absolute migration paths', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          migrations: [{ version: 1, name: 'evil', path: '/etc/passwd', content: 'malicious' }],
        }),
    })

    await expect(migrationPull({ force: true }, createMockCommand())).rejects.toThrow('invalid path segments')
    expect(mockWriteFile).not.toHaveBeenCalled()
  })

  test('propagates filesystem write errors', async () => {
    mockFetchResponse(sampleMigrations)
    mockWriteFile.mockRejectedValueOnce(new Error('EACCES: permission denied'))

    await expect(migrationPull({ force: true }, createMockCommand())).rejects.toThrow('EACCES')
  })

  test('propagates network errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    await expect(migrationPull({ force: true }, createMockCommand())).rejects.toThrow('Network error')
  })

  describe('--branch option', () => {
    test('passes explicit branch name as query parameter', async () => {
      mockFetchResponse(sampleMigrations)

      await migrationPull({ branch: 'staging', force: true }, createMockCommand())

      const calledUrl = mockFetch.mock.calls[0][0] as URL
      expect(calledUrl.searchParams.get('branch')).toBe('staging')
    })

    test('resolves local git branch when --branch is passed without a value', async () => {
      mockExeca.mockResolvedValue({ stdout: 'feature/my-branch\n' })
      mockFetchResponse(sampleMigrations)

      await migrationPull({ branch: true, force: true }, createMockCommand())

      expect(mockExeca).toHaveBeenCalledWith('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
      const calledUrl = mockFetch.mock.calls[0][0] as URL
      expect(calledUrl.searchParams.get('branch')).toBe('feature/my-branch')
    })

    test('does not send branch query parameter when --branch is not used', async () => {
      mockFetchResponse(sampleMigrations)

      await migrationPull({ force: true }, createMockCommand())

      const calledUrl = mockFetch.mock.calls[0][0] as URL
      expect(calledUrl.searchParams.has('branch')).toBe(false)
    })

    test('uses branch name in log messages', async () => {
      mockFetchResponse(sampleMigrations)

      await migrationPull({ branch: 'staging', force: true }, createMockCommand())

      expect(logMessages[0]).toContain('from staging')
    })

    test('uses branch name in json output', async () => {
      mockFetchResponse(sampleMigrations)

      await migrationPull({ branch: 'staging', force: true, json: true }, createMockCommand())

      expect(jsonMessages[0]).toEqual({
        migrations_pulled: 2,
        branch: 'staging',
        migrations: ['0001_create-users', '0002_add-posts'],
      })
    })

    test('throws when in detached HEAD state', async () => {
      mockExeca.mockResolvedValue({ stdout: 'HEAD' })

      await expect(migrationPull({ branch: true, force: true }, createMockCommand())).rejects.toThrow(
        'Could not determine the current git branch',
      )
    })

    test('falls back to NETLIFY_DB_BRANCH env var when --branch is not passed', async () => {
      process.env.NETLIFY_DB_BRANCH = 'feature-env'
      mockFetchResponse(sampleMigrations)

      await migrationPull({ force: true }, createMockCommand())

      const calledUrl = mockFetch.mock.calls[0][0] as URL
      expect(calledUrl.searchParams.get('branch')).toBe('feature-env')
    })

    test('--branch wins over NETLIFY_DB_BRANCH when both are set', async () => {
      process.env.NETLIFY_DB_BRANCH = 'env-branch'
      mockFetchResponse(sampleMigrations)

      await migrationPull({ branch: 'flag-branch', force: true }, createMockCommand())

      const calledUrl = mockFetch.mock.calls[0][0] as URL
      expect(calledUrl.searchParams.get('branch')).toBe('flag-branch')
    })
  })
})
