import { describe, expect, test, vi, beforeEach } from 'vitest'

const { mockApplyMigrations, mockCleanup, mockExecutor, logMessages, jsonMessages } = vi.hoisted(() => {
  const mockApplyMigrations = vi.fn().mockResolvedValue([])
  const mockCleanup = vi.fn().mockResolvedValue(undefined)
  const mockExecutor = {}
  const logMessages: string[] = []
  const jsonMessages: unknown[] = []
  return { mockApplyMigrations, mockCleanup, mockExecutor, logMessages, jsonMessages }
})

vi.mock('@netlify/db-dev', () => ({
  applyMigrations: (...args: unknown[]) => mockApplyMigrations(...args),
}))

vi.mock('../../../../src/commands/database/db-connection.js', () => ({
  connectToDatabase: vi.fn().mockImplementation(() =>
    Promise.resolve({
      executor: mockExecutor,
      cleanup: mockCleanup,
    }),
  ),
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

import { migrate } from '../../../../src/commands/database/migrate.js'

function createMockCommand(overrides: { buildDir?: string; projectRoot?: string; migrationsPath?: string } = {}) {
  const {
    buildDir = '/project',
    projectRoot = '/project',
    migrationsPath = '/project/netlify/db/migrations',
  } = overrides

  return {
    project: { root: projectRoot, baseDirectory: undefined },
    netlify: {
      site: { root: buildDir },
      config: { db: { migrations: { path: migrationsPath } } },
    },
  } as unknown as Parameters<typeof migrate>[1]
}

describe('migrate', () => {
  beforeEach(() => {
    logMessages.length = 0
    jsonMessages.length = 0
    vi.clearAllMocks()
    mockApplyMigrations.mockResolvedValue([])
  })

  test('calls cleanup after successful migration', async () => {
    await migrate({}, createMockCommand())

    expect(mockCleanup).toHaveBeenCalledOnce()
  })

  test('calls cleanup even when applyMigrations throws', async () => {
    mockApplyMigrations.mockRejectedValueOnce(new Error('migration failed'))

    await expect(migrate({}, createMockCommand())).rejects.toThrow('migration failed')

    expect(mockCleanup).toHaveBeenCalledOnce()
  })

  test('passes executor and migrations directory to applyMigrations', async () => {
    await migrate({}, createMockCommand({ migrationsPath: '/custom/migrations' }))

    expect(mockApplyMigrations).toHaveBeenCalledWith(mockExecutor, '/custom/migrations', undefined)
  })

  test('throws when no migrations directory is configured', async () => {
    const command = {
      project: { root: '/project', baseDirectory: undefined },
      netlify: { site: { root: '/project' }, config: {} },
    } as unknown as Parameters<typeof migrate>[1]

    await expect(migrate({}, command)).rejects.toThrow('No migrations directory found')
  })

  test('passes the --to target to applyMigrations', async () => {
    await migrate({ to: '0002_add_posts' }, createMockCommand())

    expect(mockApplyMigrations).toHaveBeenCalledWith(mockExecutor, expect.any(String), '0002_add_posts')
  })

  test('logs message when no migrations are applied', async () => {
    mockApplyMigrations.mockResolvedValueOnce([])

    await migrate({}, createMockCommand())

    expect(logMessages).toContain('No pending migrations to apply.')
  })

  test('logs each applied migration', async () => {
    mockApplyMigrations.mockResolvedValueOnce(['0001_create_users', '0002_add_posts'])

    await migrate({}, createMockCommand())

    expect(logMessages[0]).toContain('2 migrations')
    expect(logMessages).toContain('  - 0001_create_users')
    expect(logMessages).toContain('  - 0002_add_posts')
  })

  test('uses singular "migration" when only one is applied', async () => {
    mockApplyMigrations.mockResolvedValueOnce(['0001_create_users'])

    await migrate({}, createMockCommand())

    expect(logMessages[0]).toMatch(/1 migration:$/)
  })

  test('outputs JSON when --json flag is set', async () => {
    mockApplyMigrations.mockResolvedValueOnce(['0001_create_users', '0002_add_posts'])

    await migrate({ json: true }, createMockCommand())

    expect(jsonMessages).toHaveLength(1)
    expect(jsonMessages[0]).toEqual({
      migrations_applied: ['0001_create_users', '0002_add_posts'],
    })
  })

  test('outputs empty migrations_applied array in JSON mode when none applied', async () => {
    mockApplyMigrations.mockResolvedValueOnce([])

    await migrate({ json: true }, createMockCommand())

    expect(jsonMessages).toHaveLength(1)
    expect(jsonMessages[0]).toEqual({
      migrations_applied: [],
    })
  })

  test('throws when project root cannot be determined', async () => {
    const command = {
      project: { root: undefined, baseDirectory: undefined },
      netlify: { site: { root: undefined }, config: {} },
    } as unknown as Parameters<typeof migrate>[1]

    await expect(migrate({}, command)).rejects.toThrow('Could not determine the project root directory.')
  })
})
