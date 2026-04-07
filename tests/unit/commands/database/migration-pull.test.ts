import { describe, expect, test, vi, beforeEach } from 'vitest'

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

import { join } from 'path'

import inquirer from 'inquirer'
import { migrationPull } from '../../../../src/commands/database/migration-pull.js'

const sampleMigrations = [
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
  const migrationsPath = overrides.migrationsPath ?? '/project/netlify/db/migrations'

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

function mockFetchResponse(migrations: typeof sampleMigrations) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ migrations }),
  })
}

describe('migrationPull', () => {
  beforeEach(() => {
    logMessages.length = 0
    jsonMessages.length = 0
    vi.clearAllMocks()
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

    const migrationsPath = '/project/netlify/db/migrations'
    await migrationPull({}, createMockCommand({ migrationsPath }))

    expect(mockRm).toHaveBeenCalledWith(migrationsPath, { recursive: true, force: true })

    expect(mockMkdir).toHaveBeenCalledTimes(2)
    expect(mockMkdir).toHaveBeenCalledWith(join(migrationsPath, '0001_create-users'), { recursive: true })
    expect(mockMkdir).toHaveBeenCalledWith(join(migrationsPath, '0002_add-posts'), { recursive: true })

    expect(mockWriteFile).toHaveBeenCalledTimes(2)
    expect(mockWriteFile).toHaveBeenCalledWith(
      join(migrationsPath, '0001_create-users', 'migration.sql'),
      'CREATE TABLE users (id SERIAL PRIMARY KEY);',
    )
    expect(mockWriteFile).toHaveBeenCalledWith(
      join(migrationsPath, '0002_add-posts', 'migration.sql'),
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
  })
})
