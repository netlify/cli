import { promises as fs } from 'node:fs'
import { join } from 'node:path'

import tmp from 'tmp-promise'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// Integration-style tests: we let the real filesystem do its thing (via
// `tmp-promise`) and assert on the resulting file tree, but mock the slow
// and networky boundaries — `spawnAsync` (so no real `npm install` or
// `drizzle-kit generate` runs) and `connectRawClient` (so no real Postgres
// is booted). The `spawnAsync` mock simulates drizzle-kit's output by
// writing a synthetic migration file, which is enough to exercise the
// seed-prefix logic and the apply / query invocation.

const {
  mockSpawnAsync,
  mockConnectRawClient,
  mockInquirerPrompt,
  mockIsInteractive,
  mockFormatQueryResult,
  mockApplyMigrations,
  mockClientQuery,
  mockCleanup,
  logMessages,
} = vi.hoisted(() => ({
  mockSpawnAsync: vi.fn(),
  mockConnectRawClient: vi.fn(),
  mockInquirerPrompt: vi.fn(),
  mockIsInteractive: vi.fn().mockReturnValue(true),
  mockFormatQueryResult: vi.fn(),
  mockApplyMigrations: vi.fn(),
  mockClientQuery: vi.fn(),
  mockCleanup: vi.fn().mockResolvedValue(undefined),
  logMessages: [] as string[],
}))

vi.mock('inquirer', () => ({
  default: {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    prompt: (...args: unknown[]) => mockInquirerPrompt(...args),
  },
}))

vi.mock('../../../../src/commands/database/legacy/utils.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../src/commands/database/legacy/utils.js')>()),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  spawnAsync: (...args: unknown[]) => mockSpawnAsync(...args),
}))

vi.mock('../../../../src/commands/database/util/db-connection.js', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  connectRawClient: (...args: unknown[]) => mockConnectRawClient(...args),
}))

vi.mock('../../../../src/commands/database/util/psql-formatter.js', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  formatQueryResult: (...args: unknown[]) => mockFormatQueryResult(...args),
}))

vi.mock('../../../../src/utils/scripted-commands.js', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  isInteractive: () => mockIsInteractive(),
}))

vi.mock('../../../../src/lib/spinner.js', () => ({
  startSpinner: () => ({ stop: () => undefined, error: () => undefined }),
  stopSpinner: () => undefined,
}))

vi.mock('@netlify/dev', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  applyMigrations: (...args: unknown[]) => mockApplyMigrations(...args),
}))

vi.mock('../../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../../src/utils/command-helpers.js')),
  log: (...args: string[]) => {
    logMessages.push(args.join(' '))
  },
}))

import { initDatabase } from '../../../../src/commands/database/db-init.js'
import { utcTimestampPrefix } from '../../../../src/commands/database/util/timestamp.js'

let tmpDir: tmp.DirectoryResult | undefined

const projectRoot = (): string => {
  if (!tmpDir) throw new Error('tmp dir not initialized — did beforeEach run?')
  return tmpDir.path
}

function createCommand(projectRoot: string) {
  return {
    project: { root: projectRoot, baseDirectory: undefined, packageManager: null },
    netlify: {
      site: { root: projectRoot },
      config: { db: { migrations: { path: join(projectRoot, 'netlify', 'database', 'migrations') } } },
    },
  } as unknown as Parameters<typeof initDatabase>[1]
}

const setPrompts = (...responses: Record<string, unknown>[]) => {
  const queue = [...responses]
  mockInquirerPrompt.mockImplementation(() => {
    const next = queue.shift()
    if (!next) throw new Error('Unexpected inquirer.prompt call — no response queued')
    return Promise.resolve(next)
  })
}

const exists = async (path: string): Promise<boolean> => {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

const readMigrations = async (projectRoot: string): Promise<string[]> => {
  try {
    return await fs.readdir(join(projectRoot, 'netlify', 'database', 'migrations'))
  } catch {
    return []
  }
}

beforeEach(async () => {
  tmpDir = await tmp.dir({ unsafeCleanup: true })
  await fs.writeFile(join(tmpDir.path, 'package.json'), JSON.stringify({ name: 'test-project' }))

  logMessages.length = 0
  vi.clearAllMocks()

  // Simulate `drizzle-kit generate` by writing a timestamp-prefixed directory
  // with a migration.sql under the configured out dir. Anything else (package
  // installs) is a no-op.
  mockSpawnAsync.mockImplementation(async (_cmd: string, args: string[], options: { cwd?: string }) => {
    const argv = args
    if (argv.includes('drizzle-kit') && argv.includes('generate')) {
      const cwd = options.cwd ?? projectRoot()
      const migrationsDir = join(cwd, 'netlify', 'database', 'migrations')
      await fs.mkdir(migrationsDir, { recursive: true })
      const name = argv[argv.indexOf('--name') + 1]
      const prefix = utcTimestampPrefix()
      const dirName = `${prefix}_${name}`
      await fs.mkdir(join(migrationsDir, dirName), { recursive: true })
      await fs.writeFile(join(migrationsDir, dirName, 'migration.sql'), 'CREATE TABLE planets (id serial primary key);')
    }
    return 0
  })

  mockApplyMigrations.mockResolvedValue(['0001_stub_applied'])
  mockClientQuery.mockResolvedValue({
    fields: [{ name: 'id' }, { name: 'name' }],
    rows: [{ id: 3, name: 'Earth' }],
    rowCount: 1,
    command: 'SELECT',
  })
  mockConnectRawClient.mockResolvedValue({
    client: { query: mockClientQuery },
    connectionString: 'postgres://localhost/stub',
    cleanup: mockCleanup,
  })
  mockFormatQueryResult.mockReturnValue(' id | name\n----+-------\n  3 | Earth\n(1 row)')
  mockIsInteractive.mockReturnValue(true)
})

afterEach(async () => {
  if (tmpDir) {
    await tmpDir.cleanup()
    tmpDir = undefined
  }
})

describe('initDatabase (integration)', () => {
  test('raw SQL + starter writes a timestamp-prefixed migration with a CREATE TABLE and seed data', async () => {
    setPrompts({ queryStyle: 'raw' }, { answer: true })

    await initDatabase({}, createCommand(projectRoot()))

    const migrations = await readMigrations(projectRoot())
    const starter = migrations.find((name) => /^\d{14}_create_planets\.sql$/.test(name))
    if (!starter) throw new Error('starter migration not found')

    const sql = await fs.readFile(join(projectRoot(), 'netlify', 'database', 'migrations', starter), 'utf-8')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS planets')
    expect(sql).toContain("'Earth'")
    expect(sql).toContain("'Jupiter'")

    // No Drizzle scaffolding for the raw path.
    expect(await exists(join(projectRoot(), 'drizzle.config.ts'))).toBe(false)
    expect(await exists(join(projectRoot(), 'db', 'schema.ts'))).toBe(false)

    // Full apply + query cycle ran; next steps point at the raw template.
    expect(mockConnectRawClient).toHaveBeenCalledOnce()
    expect(mockApplyMigrations).toHaveBeenCalledOnce()
    expect(logMessages.join('\n')).toContain('functions:create --language typescript --template database')
  })

  test('Drizzle + starter writes schema/config, runs drizzle-kit generate, and seeds after it', async () => {
    setPrompts({ queryStyle: 'drizzle' }, { answer: true })

    await initDatabase({}, createCommand(projectRoot()))

    // Drizzle config points at the project's migrations dir.
    const config = await fs.readFile(join(projectRoot(), 'drizzle.config.ts'), 'utf-8')
    expect(config).toContain("out: 'netlify/database/migrations'")
    expect(config).toContain('drizzle-kit')

    // Schema was scaffolded (only when withStarter=true).
    const schema = await fs.readFile(join(projectRoot(), 'db', 'schema.ts'), 'utf-8')
    expect(schema).toContain("pgTable('planets'")
    expect(schema).toContain('doublePrecision')

    // drizzle-kit generate was invoked with --name create_planets.
    const generate = mockSpawnAsync.mock.calls.find((call) => {
      const argv = call[1] as string[]
      return argv.includes('drizzle-kit') && argv.includes('generate')
    })
    if (!generate) throw new Error('drizzle-kit generate was not invoked')
    const argv = generate[1] as string[]
    expect(argv).toContain('--name')
    expect(argv[argv.indexOf('--name') + 1]).toBe('create_planets')

    // Both the drizzle-kit output and our seed file exist, and the seed sorts
    // lexicographically AFTER the drizzle-kit directory (regression for the
    // "0001_seed_planets runs before 2026…_create_planets" bug).
    const entries = (await readMigrations(projectRoot())).sort()
    const createDir = entries.find((name) => name.includes('create_planets'))
    const seedDir = entries.find((name) => name.includes('seed_planets'))
    if (!createDir || !seedDir) throw new Error('expected both the drizzle-kit migration and the seed migration')
    expect(seedDir.localeCompare(createDir)).toBeGreaterThan(0)

    // Drizzle-style seed uses the directory layout, matching drizzle-kit's
    // own output format.
    const seedPath = join(projectRoot(), 'netlify', 'database', 'migrations', seedDir, 'migration.sql')
    const seedSql = await fs.readFile(seedPath, 'utf-8')
    expect(seedSql).toContain("'Earth'")

    expect(logMessages.join('\n')).toContain('functions:create --language typescript --template database-drizzle')
  })

  test('Drizzle without starter scaffolds drizzle.config.ts only (no schema, no migration, no generate)', async () => {
    setPrompts({ queryStyle: 'drizzle' }, { answer: false })

    await initDatabase({}, createCommand(projectRoot()))

    expect(await exists(join(projectRoot(), 'drizzle.config.ts'))).toBe(true)
    expect(await exists(join(projectRoot(), 'db', 'schema.ts'))).toBe(false)
    expect(await readMigrations(projectRoot())).toHaveLength(0)

    const generate = mockSpawnAsync.mock.calls.find((call) => (call[1] as string[]).includes('drizzle-kit'))
    expect(generate).toBeUndefined()
    expect(mockConnectRawClient).not.toHaveBeenCalled()

    const output = logMessages.join('\n')
    expect(output).toContain('drizzle-kit generate')
    expect(output).not.toContain('database connect --query "SELECT * FROM planets"')
  })

  test('raw without starter writes nothing extra; next steps point at `database migrations new`', async () => {
    setPrompts({ queryStyle: 'raw' }, { answer: false })

    await initDatabase({}, createCommand(projectRoot()))

    expect(await exists(join(projectRoot(), 'drizzle.config.ts'))).toBe(false)
    expect(await exists(join(projectRoot(), 'db', 'schema.ts'))).toBe(false)
    expect(await readMigrations(projectRoot())).toHaveLength(0)
    expect(mockConnectRawClient).not.toHaveBeenCalled()

    const output = logMessages.join('\n')
    expect(output).toContain('database migrations new')
    expect(output).not.toContain('database connect --query "SELECT * FROM planets"')
  })

  test('aborts when migrations already exist; nothing on disk changes', async () => {
    const migrationsDir = join(projectRoot(), 'netlify', 'database', 'migrations')
    await fs.mkdir(migrationsDir, { recursive: true })
    await fs.writeFile(join(migrationsDir, '0001_existing.sql'), '-- pre-existing')

    await initDatabase({}, createCommand(projectRoot()))

    expect(await readMigrations(projectRoot())).toEqual(['0001_existing.sql'])
    expect(mockInquirerPrompt).not.toHaveBeenCalled()
    expect(mockSpawnAsync).not.toHaveBeenCalled()
    expect(mockConnectRawClient).not.toHaveBeenCalled()
    expect(logMessages.join('\n')).toContain('you already have migrations set up')
  })

  test('non-interactive (no TTY) runs the full Drizzle flow without prompting', async () => {
    mockIsInteractive.mockReturnValue(false)

    await initDatabase({}, createCommand(projectRoot()))

    expect(mockInquirerPrompt).not.toHaveBeenCalled()
    expect(await exists(join(projectRoot(), 'drizzle.config.ts'))).toBe(true)
    expect(await exists(join(projectRoot(), 'db', 'schema.ts'))).toBe(true)
    expect((await readMigrations(projectRoot())).some((name) => name.includes('seed_planets'))).toBe(true)
    expect(mockConnectRawClient).toHaveBeenCalledOnce()
    expect(mockApplyMigrations).toHaveBeenCalledOnce()
  })

  test('throws when project root cannot be determined', async () => {
    const command = {
      project: { root: undefined, baseDirectory: undefined, packageManager: null },
      netlify: { site: { root: undefined }, config: {} },
    } as unknown as Parameters<typeof initDatabase>[1]

    await expect(initDatabase({}, command)).rejects.toThrow('Could not determine the project root')
  })
})
