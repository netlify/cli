import { describe, expect, test, vi, beforeEach } from 'vitest'

const { mockReaddir, mockMkdir, mockWriteFile, logMessages, jsonMessages } = vi.hoisted(() => {
  const mockReaddir = vi.fn().mockResolvedValue([])
  const mockMkdir = vi.fn().mockResolvedValue(undefined)
  const mockWriteFile = vi.fn().mockResolvedValue(undefined)
  const logMessages: string[] = []
  const jsonMessages: unknown[] = []
  return { mockReaddir, mockMkdir, mockWriteFile, logMessages, jsonMessages }
})

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>()
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    readdir: (...args: unknown[]) => mockReaddir(...args),
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

import { join } from 'path'

import inquirer from 'inquirer'
import {
  migrationNew,
  generateSlug,
  detectNumberingScheme,
  generateNextPrefix,
  resolveMigrationsDirectory,
} from '../../../../src/commands/database/migration-new.js'

function createMockCommand(overrides: { migrationsPath?: string | undefined } = {}) {
  const { migrationsPath = '/project/netlify/db/migrations' } = overrides

  return {
    project: { root: '/project', baseDirectory: undefined },
    netlify: {
      site: { root: '/project' },
      config: migrationsPath ? { db: { migrations: { path: migrationsPath } } } : {},
    },
  } as unknown as Parameters<typeof migrationNew>[1]
}

function dirEntry(name: string) {
  return { name, isDirectory: () => true }
}

describe('generateSlug', () => {
  test.each([
    { input: 'Add users table', expected: 'add-users-table' },
    { input: '  add  posts  table  ', expected: 'add-posts-table' },
    { input: "Add user's email & phone!", expected: 'add-users-email-phone' },
    { input: 'add_user_table', expected: 'add-user-table' },
    { input: 'Create INDEX on Users', expected: 'create-index-on-users' },
  ])('generates "$expected" from "$input"', ({ input, expected }) => {
    expect(generateSlug(input)).toBe(expected)
  })

  test.each(['!!!', '___', '   ', '@#$%'])('returns empty string for non-alphanumeric input "%s"', (input) => {
    expect(generateSlug(input)).toBe('')
  })
})

describe('detectNumberingScheme', () => {
  test('returns undefined for empty list', () => {
    expect(detectNumberingScheme([])).toBeUndefined()
  })

  test('detects sequential numbering', () => {
    expect(detectNumberingScheme(['0001_create-users', '0002_add-posts'])).toBe('sequential')
  })

  test('detects timestamp numbering', () => {
    expect(detectNumberingScheme(['20260312143000_create-users', '20260312150000_add-posts'])).toBe('timestamp')
  })

  test('returns undefined for unrecognized patterns', () => {
    expect(detectNumberingScheme(['v1_create-users', 'v2_add-posts'])).toBeUndefined()
  })
})

describe('generateNextPrefix', () => {
  test('generates first sequential prefix when no existing migrations', () => {
    expect(generateNextPrefix([], 'sequential')).toBe('0001')
  })

  test('increments sequential prefix', () => {
    expect(generateNextPrefix(['0003_create-users', '0007_add-posts'], 'sequential')).toBe('0008')
  })

  test('generates timestamp prefix with 14 digits', () => {
    const prefix = generateNextPrefix([], 'timestamp')
    expect(prefix).toMatch(/^\d{14}$/)
  })

  test('ignores timestamp-style names when computing sequential prefix', () => {
    expect(generateNextPrefix(['20260312143000_add-users', '0003_add-posts'], 'sequential')).toBe('0004')
  })
})

describe('resolveMigrationsDirectory', () => {
  test('returns configured path when present', () => {
    const command = createMockCommand({ migrationsPath: '/custom/migrations' })
    expect(resolveMigrationsDirectory(command)).toBe('/custom/migrations')
  })

  test('falls back to default path under project root', () => {
    const command = {
      project: { root: '/project', baseDirectory: undefined },
      netlify: { site: { root: '/project' }, config: {} },
    } as unknown as Parameters<typeof resolveMigrationsDirectory>[0]

    expect(resolveMigrationsDirectory(command)).toBe(join('/project', 'netlify', 'db', 'migrations'))
  })

  test('throws when no config path and no project root', () => {
    const command = {
      project: { root: undefined, baseDirectory: undefined },
      netlify: { site: { root: undefined }, config: {} },
    } as unknown as Parameters<typeof resolveMigrationsDirectory>[0]

    expect(() => resolveMigrationsDirectory(command)).toThrow('Could not determine the project root directory.')
  })
})

describe('migrationNew', () => {
  beforeEach(() => {
    logMessages.length = 0
    jsonMessages.length = 0
    vi.clearAllMocks()
    mockReaddir.mockResolvedValue([])
  })

  test('falls back to default path when no migrations path is configured', async () => {
    const command = {
      project: { root: '/project', baseDirectory: undefined },
      netlify: { site: { root: '/project' }, config: {} },
    } as unknown as Parameters<typeof migrationNew>[1]

    await migrationNew({ description: 'add users', scheme: 'sequential' }, command)

    expect(mockMkdir).toHaveBeenCalledWith(join('/project', 'netlify', 'db', 'migrations', '0001_add-users'), {
      recursive: true,
    })
  })

  test('creates migration folder and file with non-interactive flags', async () => {
    mockReaddir.mockResolvedValue([dirEntry('0001_create-users')])

    await migrationNew({ description: 'add posts table', scheme: 'sequential' }, createMockCommand())

    const expectedFolder = join('/project/netlify/db/migrations', '0002_add-posts-table')
    expect(mockMkdir).toHaveBeenCalledWith(expectedFolder, { recursive: true })
    expect(mockWriteFile).toHaveBeenCalledWith(
      join(expectedFolder, 'migration.sql'),
      expect.stringContaining('-- Write your migration SQL here'),
      {
        flag: 'wx',
      },
    )
  })

  test('outputs creation message to log', async () => {
    await migrationNew({ description: 'add posts table', scheme: 'sequential' }, createMockCommand())

    expect(logMessages[0]).toContain('Created migration: 0001_add-posts-table')
  })

  test('outputs JSON when --json flag is set', async () => {
    await migrationNew({ description: 'add posts table', scheme: 'sequential', json: true }, createMockCommand())

    expect(jsonMessages).toHaveLength(1)
    expect(jsonMessages[0]).toEqual({
      path: join('/project/netlify/db/migrations', '0001_add-posts-table'),
      name: '0001_add-posts-table',
    })
  })

  test('prompts for description when not provided', async () => {
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ description: 'create users table' })
      .mockResolvedValueOnce({ scheme: 'sequential' })

    await migrationNew({}, createMockCommand())

    expect(inquirer.prompt).toHaveBeenCalledTimes(2)
    expect(mockMkdir).toHaveBeenCalledWith(expect.stringContaining('create-users-table'), expect.any(Object))
  })

  test('prompts for scheme with detected default when not provided', async () => {
    mockReaddir.mockResolvedValue([dirEntry('0001_create-users'), dirEntry('0002_add-posts')])
    vi.mocked(inquirer.prompt).mockResolvedValueOnce({ scheme: 'sequential' })

    await migrationNew({ description: 'add comments' }, createMockCommand())

    const promptCall = vi.mocked(inquirer.prompt).mock.calls[0][0] as { default?: string }[]
    expect(promptCall[0].default).toBe('sequential')
  })

  test('uses timestamp scheme when specified', async () => {
    await migrationNew({ description: 'add posts table', scheme: 'timestamp' }, createMockCommand())

    const mkdirCall = mockMkdir.mock.calls[0][0] as string
    const folderName = mkdirCall.split(/[/\\]/).pop() ?? ''
    expect(folderName).toMatch(/^\d{14}_add-posts-table$/)
  })

  test('throws when description produces an empty slug', async () => {
    await expect(migrationNew({ description: '!!!', scheme: 'sequential' }, createMockCommand())).rejects.toThrow(
      'produces an empty slug',
    )

    expect(mockMkdir).not.toHaveBeenCalled()
    expect(mockWriteFile).not.toHaveBeenCalled()
  })

  test('throws when migration file already exists', async () => {
    const existsError = new Error('EEXIST: file already exists') as NodeJS.ErrnoException
    existsError.code = 'EEXIST'
    mockWriteFile.mockRejectedValueOnce(existsError)

    await expect(
      migrationNew({ description: 'add posts table', scheme: 'sequential' }, createMockCommand()),
    ).rejects.toThrow()
  })

  test('handles missing migrations directory gracefully', async () => {
    const readError = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException
    readError.code = 'ENOENT'
    mockReaddir.mockRejectedValue(readError)

    await migrationNew({ description: 'initial migration', scheme: 'sequential' }, createMockCommand())

    expect(mockMkdir).toHaveBeenCalledWith(join('/project/netlify/db/migrations', '0001_initial-migration'), {
      recursive: true,
    })
  })

  test('rethrows non-ENOENT readdir errors', async () => {
    const permError = new Error('EACCES: permission denied') as NodeJS.ErrnoException
    permError.code = 'EACCES'
    mockReaddir.mockRejectedValue(permError)

    await expect(
      migrationNew({ description: 'add table', scheme: 'sequential' }, createMockCommand()),
    ).rejects.toThrow('EACCES')
  })
})
