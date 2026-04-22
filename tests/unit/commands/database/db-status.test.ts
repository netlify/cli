import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'

const {
  mockReaddir,
  mockReadFile,
  mockFileExistsAsync,
  mockConnectToDatabase,
  mockDetectExisting,
  mockQuery,
  mockCleanup,
  mockFetch,
  logMessages,
  jsonMessages,
} = vi.hoisted(() => {
  const mockReaddir = vi.fn()
  const mockReadFile = vi.fn()
  const mockFileExistsAsync = vi.fn()
  const mockQuery = vi.fn()
  const mockCleanup = vi.fn().mockResolvedValue(undefined)
  const mockConnectToDatabase = vi.fn()
  const mockDetectExisting = vi.fn()
  const mockFetch = vi.fn()
  const logMessages: string[] = []
  const jsonMessages: unknown[] = []
  return {
    mockReaddir,
    mockReadFile,
    mockFileExistsAsync,
    mockConnectToDatabase,
    mockDetectExisting,
    mockQuery,
    mockCleanup,
    mockFetch,
    logMessages,
    jsonMessages,
  }
})

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>()
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    readdir: (...args: unknown[]) => mockReaddir(...args),
    readFile: (path: unknown, ...rest: unknown[]) => {
      // Only intercept reads under the mocked project root — the CLI's own
      // package.json and other ambient reads go straight through.
      if (typeof path === 'string' && path.startsWith('/project/')) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return mockReadFile(path, ...rest)
      }
      return actual.readFile(
        path as Parameters<typeof actual.readFile>[0],
        rest[0] as Parameters<typeof actual.readFile>[1],
      )
    },
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

vi.mock('../../../../src/lib/fs.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../src/lib/fs.js')>()),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  fileExistsAsync: (path: string) => mockFileExistsAsync(path),
}))

vi.mock('../../../../src/commands/database/util/db-connection.js', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  connectToDatabase: (...args: unknown[]) => mockConnectToDatabase(...args),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  detectExistingLocalConnectionString: (...args: unknown[]) => mockDetectExisting(...args),
}))

vi.stubGlobal('fetch', mockFetch)

import { statusDb } from '../../../../src/commands/database/db-status.js'

const SITE_NAME = 'my-site'
const LOCAL_CONN_WITH_CREDS = 'postgres://user:password@localhost:5432/netlify'
const LOCAL_CONN_NO_CREDS = 'postgres://localhost:5432/postgres'
const BRANCH_CONN = 'postgres://admin:secret@branch-host.neon.tech/db'
const PROD_CONN = 'postgres://owner:prodsecret@prod-host.neon.tech/db'

interface MockFSNode {
  files?: Record<string, string>
  dirs?: Record<string, MockFSNode>
}

const DEFAULT_MOCK_FS_ROOT = '/project/netlify/database/migrations'

const mockFS = (tree: MockFSNode, { root = DEFAULT_MOCK_FS_ROOT }: { root?: string } = {}) => {
  const resolve = (absolutePath: string): { kind: 'dir'; node: MockFSNode } | { kind: 'file' } | null => {
    const normalizedRoot = root.replace(/\/+$/, '')
    if (absolutePath !== normalizedRoot && !absolutePath.startsWith(`${normalizedRoot}/`)) {
      return null
    }
    const relative = absolutePath.slice(normalizedRoot.length).replace(/^\/+/, '')
    if (relative === '') return { kind: 'dir', node: tree }
    const parts = relative.split('/')
    let cursor: MockFSNode = tree
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      if (isLast && cursor.files && part in cursor.files) return { kind: 'file' }
      if (cursor.dirs && part in cursor.dirs) {
        cursor = cursor.dirs[part]
        if (isLast) return { kind: 'dir', node: cursor }
        continue
      }
      return null
    }
    return null
  }

  mockReaddir.mockImplementation((path: unknown) => {
    const resolved = typeof path === 'string' ? resolve(path) : null
    if (!resolved || resolved.kind !== 'dir') {
      return Promise.reject(Object.assign(new Error(`ENOENT: ${String(path)}`), { code: 'ENOENT' }))
    }
    const dirEntries = Object.keys(resolved.node.dirs ?? {}).map((name) => ({
      name,
      isDirectory: () => true,
      isFile: () => false,
    }))
    const fileEntries = Object.keys(resolved.node.files ?? {}).map((name) => ({
      name,
      isDirectory: () => false,
      isFile: () => true,
    }))
    return Promise.resolve([...dirEntries, ...fileEntries])
  })

  mockFileExistsAsync.mockImplementation((path: unknown) => Promise.resolve(typeof path === 'string' && resolve(path) !== null))
}

const migrationsTree = (names: string[]): MockFSNode => ({
  dirs: Object.fromEntries(names.map((name) => [name, { files: { 'migration.sql': '' } }])),
})

function createMockCommand(
  overrides: { siteRoot?: string | null; migrationsPath?: string | null; siteId?: string | null } = {},
) {
  const siteRoot = overrides.siteRoot === null ? undefined : overrides.siteRoot ?? '/project'
  const migrationsPath =
    overrides.migrationsPath === null ? undefined : overrides.migrationsPath ?? '/project/netlify/database/migrations'
  const siteId = overrides.siteId === null ? undefined : overrides.siteId ?? 'site-123'

  return {
    siteId,
    project: { root: '/project', baseDirectory: undefined },
    netlify: {
      site: { root: siteRoot, id: siteId },
      siteInfo: { id: siteId, name: SITE_NAME },
      config: migrationsPath ? { db: { migrations: { path: migrationsPath } } } : {},
      api: {
        accessToken: 'Bearer test-token',
        basePath: 'https://api.netlify.com/api/v1',
      },
    },
  } as unknown as Parameters<typeof statusDb>[1]
}

interface FetchRoutes {
  siteDatabase?: { connection_string: string } | null
  branch?: Record<string, { connection_string: string }>
  migrations?: Record<string, { version: number; name: string; path: string; applied: boolean }[]>
}

function setupFetchRouter(routes: FetchRoutes) {
  mockFetch.mockImplementation((url: URL | string) => {
    const urlString = typeof url === 'string' ? url : url.toString()
    const path = typeof url === 'string' ? new URL(url).pathname : url.pathname

    if (path.endsWith('/database/')) {
      if (!routes.siteDatabase) {
        return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('not found') })
      }
      const body = routes.siteDatabase
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })
    }

    const branchMatch = /\/database\/branch\/([^/]+)$/.exec(path)
    if (branchMatch) {
      const branchId = decodeURIComponent(branchMatch[1])
      const branchData = routes.branch?.[branchId]
      if (branchData) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(branchData) })
      }
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('not found') })
    }

    if (path.endsWith('/database/migrations')) {
      const branchId = new URL(urlString).searchParams.get('branch') ?? 'production'
      const migrations = routes.migrations?.[branchId] ?? []
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ migrations }) })
    }

    return Promise.reject(new Error(`Unexpected fetch: ${urlString}`))
  })
}

function mockLocalAppliedRows(names: string[]) {
  mockQuery.mockResolvedValue({ rows: names.map((name) => ({ name })) })
}

function mockPackageJson(contents: Record<string, unknown>) {
  mockReadFile.mockImplementation((path: unknown) => {
    if (typeof path === 'string' && path.endsWith('package.json')) {
      return Promise.resolve(JSON.stringify(contents))
    }
    // Fallback: treat anything else we intercept as an empty migration file.
    return Promise.resolve('')
  })
}

function setLocalDatabaseRunning(connectionString: string) {
  mockDetectExisting.mockReturnValue(connectionString)
  mockConnectToDatabase.mockImplementation(() =>
    Promise.resolve({
      executor: { query: mockQuery },
      connectionString,
      cleanup: mockCleanup,
    }),
  )
}

beforeEach(() => {
  logMessages.length = 0
  jsonMessages.length = 0
  vi.clearAllMocks()
  mockFS({})
  mockCleanup.mockResolvedValue(undefined)
  mockLocalAppliedRows([])
  setupFetchRouter({ siteDatabase: null })
  mockPackageJson({ dependencies: { '@netlify/database': '^1.0.0' } })
  setLocalDatabaseRunning(LOCAL_CONN_WITH_CREDS)
  delete process.env.NETLIFY_DB_URL
  delete process.env.NETLIFY_DB_BRANCH
})

afterEach(() => {
  delete process.env.NETLIFY_DB_URL
  delete process.env.NETLIFY_DB_BRANCH
})

describe('statusDb', () => {
  describe('enabled flag', () => {
    test('reports enabled=true when NETLIFY_DB_URL is set', async () => {
      process.env.NETLIFY_DB_URL = 'postgres://x/y'
      setupFetchRouter({ siteDatabase: null })

      await statusDb({ json: true }, createMockCommand())

      expect(jsonMessages[0]).toMatchObject({ enabled: true })
    })

    test('reports enabled=true when getSiteDatabase returns a DB', async () => {
      setupFetchRouter({ siteDatabase: { connection_string: PROD_CONN } })

      await statusDb({ json: true }, createMockCommand())

      expect(jsonMessages[0]).toMatchObject({ enabled: true })
    })

    test('reports enabled=false when neither env nor server has a DB', async () => {
      setupFetchRouter({ siteDatabase: null })

      await statusDb({ json: true }, createMockCommand())

      expect(jsonMessages[0]).toMatchObject({ enabled: false })
    })

    test('skips server check if siteId or token is missing', async () => {
      await statusDb({ json: true }, createMockCommand({ siteId: null }))

      const calls = mockFetch.mock.calls
      const anyDatabaseCall = calls.some((c) => {
        const u = c[0] as URL | string
        const p = typeof u === 'string' ? u : u.toString()
        return p.endsWith('/database/')
      })
      expect(anyDatabaseCall).toBe(false)
    })
  })

  describe('package-installed flag', () => {
    test('reports packageInstalled=true when listed in dependencies', async () => {
      mockPackageJson({ dependencies: { '@netlify/database': '^1.0.0' } })

      await statusDb({ json: true }, createMockCommand())

      expect(jsonMessages[0]).toMatchObject({ packageInstalled: true })
    })

    test('reports packageInstalled=true when listed in devDependencies', async () => {
      mockPackageJson({ devDependencies: { '@netlify/database': '^1.0.0' } })

      await statusDb({ json: true }, createMockCommand())

      expect(jsonMessages[0]).toMatchObject({ packageInstalled: true })
    })

    test('reports packageInstalled=false when not listed', async () => {
      mockPackageJson({ dependencies: { react: '^18.0.0' } })

      await statusDb({ json: true }, createMockCommand())

      expect(jsonMessages[0]).toMatchObject({ packageInstalled: false })
    })

    test('reports packageInstalled=false when package.json is missing or unreadable', async () => {
      mockReadFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))

      await statusDb({ json: true }, createMockCommand())

      expect(jsonMessages[0]).toMatchObject({ packageInstalled: false })
    })
  })

  describe('without --url (local database)', () => {
    test('throws when project root cannot be determined', async () => {
      const command = createMockCommand({ siteRoot: null })
      ;(command as { project: { root: string | undefined } }).project = { root: undefined }

      await expect(statusDb({}, command)).rejects.toThrow('Could not determine the project root')
    })

    test('connects to the local database when one is already running', async () => {
      await statusDb({ json: true }, createMockCommand())

      expect(mockDetectExisting).toHaveBeenCalledWith('/project')
      expect(mockConnectToDatabase).toHaveBeenCalledWith('/project')
      expect(mockQuery).toHaveBeenCalledTimes(1)
      const sql = mockQuery.mock.calls[0][0] as string
      expect(sql).toContain('netlify.migrations')
    })

    test('still connects and reads migration state when no local database is already running', async () => {
      mockDetectExisting.mockReturnValue(null)
      mockLocalAppliedRows(['0001_a'])
      mockFS(migrationsTree(['0001_a', '0002_b']))

      await statusDb({ json: true }, createMockCommand())

      // We still spin up a DB to read migration state.
      expect(mockConnectToDatabase).toHaveBeenCalledTimes(1)
      expect(mockQuery).toHaveBeenCalledTimes(1)
      expect(jsonMessages[0]).toMatchObject({
        applied: [{ version: 1, name: '0001_a' }],
        pending: [{ version: 2, name: '0002_b' }],
      })
    })

    test('suppresses the connection string in JSON output when no persistent local database is running', async () => {
      mockDetectExisting.mockReturnValue(null)

      await statusDb({ json: true }, createMockCommand())

      expect(jsonMessages[0]).toMatchObject({
        target: 'local',
        database: null,
      })
    })

    test('default output hints at starting a persistent local database when none is running', async () => {
      mockDetectExisting.mockReturnValue(null)
      mockLocalAppliedRows(['0001_a'])
      mockFS(migrationsTree(['0001_a', '0002_b']))

      await statusDb({}, createMockCommand())

      const output = logMessages.join('\n')
      expect(output).toContain('The local database is not running')
      expect(output).toContain('netlify dev')
      // Migration state is still rendered — connection string is the only thing suppressed.
      expect(output).toContain('Applied migrations')
      expect(output).toContain('• 0001_a')
      expect(output).toContain('• 0002_b')
    })

    test('cleans up the database connection even when query throws', async () => {
      mockQuery.mockRejectedValue(Object.assign(new Error('boom'), { code: '08000' }))

      await expect(statusDb({}, createMockCommand())).rejects.toThrow('boom')

      expect(mockCleanup).toHaveBeenCalledTimes(1)
    })

    test('reports applied and pending correctly', async () => {
      mockLocalAppliedRows(['0001_a', '0002_b'])
      mockFS(migrationsTree(['0001_a', '0002_b', '0003_c']))

      await statusDb({ json: true }, createMockCommand())

      expect(jsonMessages[0]).toMatchObject({
        target: 'local',
        applied: [
          { version: 1, name: '0001_a' },
          { version: 2, name: '0002_b' },
        ],
        pending: [{ version: 3, name: '0003_c' }],
      })
    })

    test('returns redacted connection string by default', async () => {
      await statusDb({ json: true }, createMockCommand())

      expect(jsonMessages[0]).toMatchObject({
        database: { connectionString: 'postgres://***:***@localhost:5432/netlify' },
      })
    })

    test('returns full connection string with --show-credentials', async () => {
      await statusDb({ json: true, showCredentials: true }, createMockCommand())

      expect(jsonMessages[0]).toMatchObject({
        database: { connectionString: LOCAL_CONN_WITH_CREDS },
      })
    })

    test('default output shows applied and pending as bullets', async () => {
      mockLocalAppliedRows(['0001_a'])
      mockFS(migrationsTree(['0001_a', '0002_b']))

      await statusDb({}, createMockCommand())

      const output = logMessages.join('\n')
      expect(output).toContain('Applied migrations')
      expect(output).toContain('• 0001_a')
      expect(output).toContain('Migrations not applied')
      expect(output).toContain('• 0002_b')
    })

    test('default output includes the apply-command hint when pending migrations exist on local', async () => {
      mockLocalAppliedRows([])
      mockFS(migrationsTree(['0001_a']))

      await statusDb({}, createMockCommand())

      expect(logMessages.join('\n')).toContain('netlify database migrations apply')
    })

    test('default output omits the apply-command hint when there are no pending migrations', async () => {
      mockLocalAppliedRows(['0001_a'])
      mockFS(migrationsTree(['0001_a']))

      await statusDb({}, createMockCommand())

      expect(logMessages.join('\n')).not.toContain('netlify database migrations apply')
    })

    test('shows --show-credentials hint when connection has credentials', async () => {
      await statusDb({}, createMockCommand())

      expect(logMessages.join('\n')).toContain('--show-credentials')
    })

    test('omits --show-credentials hint when the connection string has no credentials', async () => {
      setLocalDatabaseRunning(LOCAL_CONN_NO_CREDS)

      await statusDb({}, createMockCommand())

      expect(logMessages.join('\n')).not.toContain('--show-credentials')
    })

    test('default output omits the --show-credentials hint when credentials are shown', async () => {
      await statusDb({ showCredentials: true }, createMockCommand())

      expect(logMessages.join('\n')).not.toContain('To reveal the full connection string')
    })
  })

  describe('local migration discovery', () => {
    test('ignores directories that do not contain a migration.sql file', async () => {
      mockFS({
        dirs: {
          '0001_with_sql': { files: { 'migration.sql': '' } },
          '0002_without_sql': {},
          '0003_wrong_file': { files: { 'readme.md': '' } },
        },
      })

      await statusDb({ json: true }, createMockCommand())

      expect(jsonMessages[0]).toMatchObject({
        pending: [{ version: 1, name: '0001_with_sql' }],
      })
    })

    test('includes .sql files sitting directly under the migrations directory', async () => {
      mockFS({
        files: {
          '0001_a.sql': '',
          '0002_b.sql': '',
        },
      })

      await statusDb({ json: true }, createMockCommand())

      expect(jsonMessages[0]).toMatchObject({
        pending: [
          { version: 1, name: '0001_a' },
          { version: 2, name: '0002_b' },
        ],
      })
    })

    test('ignores directories whose name does not match the migration pattern', async () => {
      mockFS({
        dirs: {
          '0001_valid': { files: { 'migration.sql': '' } },
          '0002_with-hyphen': { files: { 'migration.sql': '' } },
          'not-a-migration': { files: { 'migration.sql': '' } },
          '0003_UPPERCASE': { files: { 'migration.sql': '' } },
          '0004-hyphen-separator': { files: { 'migration.sql': '' } },
          no_leading_digits: { files: { 'migration.sql': '' } },
        },
      })

      await statusDb({ json: true }, createMockCommand())

      expect(jsonMessages[0]).toMatchObject({
        pending: [
          { version: 1, name: '0001_valid' },
          { version: 2, name: '0002_with-hyphen' },
        ],
      })
    })

    test('ignores .sql files whose name does not match the migration pattern', async () => {
      mockFS({
        files: {
          '0001_valid.sql': '',
          '0002_with-hyphen.sql': '',
          'random.sql': '',
          '0003_UPPERCASE.sql': '',
          '0004-hyphen-separator.sql': '',
        },
      })

      await statusDb({ json: true }, createMockCommand())

      expect(jsonMessages[0]).toMatchObject({
        pending: [
          { version: 1, name: '0001_valid' },
          { version: 2, name: '0002_with-hyphen' },
        ],
      })
    })
  })

  describe('secondary descriptive lines', () => {
    test('renders a descriptive line under Enabled when true', async () => {
      process.env.NETLIFY_DB_URL = 'postgres://x/y'

      await statusDb({}, createMockCommand())

      expect(logMessages.join('\n')).toContain('Netlify Database is enabled for this project')
    })

    test('renders a dashboard link under Enabled when siteInfo has an admin_url', async () => {
      process.env.NETLIFY_DB_URL = 'postgres://x/y'
      const command = createMockCommand()
      ;(command as { netlify: { siteInfo: { admin_url?: string } } }).netlify.siteInfo.admin_url =
        'https://app.netlify.com/sites/my-site'

      await statusDb({}, command)

      expect(logMessages.join('\n')).toContain('Manage your database at https://app.netlify.com/sites/my-site')
    })

    test('renders an install hint under Enabled when disabled', async () => {
      setupFetchRouter({ siteDatabase: null })

      await statusDb({}, createMockCommand())

      const output = logMessages.join('\n')
      expect(output).toContain('Install the @netlify/database package and deploy your site')
    })

    test('renders an installed statement under Package when installed', async () => {
      await statusDb({}, createMockCommand())
      console.log({ wat: logMessages.join('\n') })
      expect(logMessages.join('\n')).toContain('The @netlify/database package is installed')
    })

    test('renders an API-reference link under Package when installed', async () => {
      await statusDb({}, createMockCommand())

      expect(logMessages.join('\n')).toContain('For a full API reference, visit https://ntl.fyi/database')
    })

    test('renders an install hint under Package when not installed', async () => {
      mockPackageJson({ dependencies: {} })

      await statusDb({}, createMockCommand())

      expect(logMessages.join('\n')).toContain('Install it with `npm install @netlify/database`')
    })
  })

  describe('section subtitles', () => {
    test('renders a subtitle under the Netlify Database title', async () => {
      await statusDb({}, createMockCommand())

      expect(logMessages.join('\n')).toContain(
        'Managed Postgres databases that seamlessly integrate with the Netlify workflow',
      )
    })

    test('renders a subtitle under Applied migrations', async () => {
      await statusDb({}, createMockCommand())

      expect(logMessages.join('\n')).toContain('Migrations that have been applied to the database branch')
    })

    test('renders a subtitle under Migrations not applied', async () => {
      await statusDb({}, createMockCommand())

      expect(logMessages.join('\n')).toContain("Migrations that exist locally that haven't yet been applied")
    })

    test('always renders the immutability note below the Applied migrations list', async () => {
      mockLocalAppliedRows(['0001_a'])
      mockFS(migrationsTree(['0001_a']))

      await statusDb({}, createMockCommand())

      const output = logMessages.join('\n')
      // Note appears after the bullet list.
      const bulletIndex = output.indexOf('• 0001_a')
      const noteIndex = output.indexOf('Note that these migrations cannot be removed or edited')
      expect(bulletIndex).toBeGreaterThanOrEqual(0)
      expect(noteIndex).toBeGreaterThan(bulletIndex)
      expect(output).toContain('you should generate a new migration')
    })

    test('renders the immutability note regardless of NETLIFY_AGENT_RUNNER_ID', async () => {
      // env var intentionally unset in beforeEach
      await statusDb({}, createMockCommand())

      expect(logMessages.join('\n')).toContain('Note that these migrations cannot be removed or edited')
    })
  })

  describe('command invocation rendering', () => {
    test('uses `netlify` directly when not invoked via npx/pnpm', async () => {
      delete process.env.npm_lifecycle_event
      delete process.env.npm_config_user_agent
      delete process.env.npm_command

      await statusDb({}, createMockCommand())
      const output = logMessages.join('\n')

      expect(output).toContain('netlify database connect')
      expect(output).toContain('netlify database status --show-credentials')
      expect(output).not.toContain('npx netlify')
    })

    test('prefixes with `npx` when invoked through npx', async () => {
      process.env.npm_lifecycle_event = 'npx'

      await statusDb({}, createMockCommand())
      const output = logMessages.join('\n')

      expect(output).toContain('npx netlify database connect')
      expect(output).toContain('npx netlify database status --show-credentials')
    })

    test('uses the dynamic command in the apply-pending hint', async () => {
      mockLocalAppliedRows([])
      mockFS(migrationsTree(['0001_a']))

      await statusDb({}, createMockCommand())

      expect(logMessages.join('\n')).toContain('netlify database migrations apply')
    })

    test('uses the dynamic command in the not-running hint', async () => {
      mockDetectExisting.mockReturnValue(null)

      await statusDb({}, createMockCommand())

      expect(logMessages.join('\n')).toContain('netlify dev')
    })
  })

  describe('with --branch (remote branch)', () => {
    test('fetches the branch connection and migrations using the provided branch name', async () => {
      setupFetchRouter({
        siteDatabase: { connection_string: PROD_CONN },
        branch: { 'feature-x': { connection_string: BRANCH_CONN } },
        migrations: { 'feature-x': [] },
      })

      await statusDb({ branch: 'feature-x', json: true }, createMockCommand())

      const fetchedUrls = mockFetch.mock.calls.map((c) => {
        const u = c[0] as URL | string
        return typeof u === 'string' ? u : u.toString()
      })
      expect(fetchedUrls.some((u) => u.includes('/database/branch/feature-x'))).toBe(true)
      expect(fetchedUrls.some((u) => u.includes('/database/migrations') && u.includes('branch=feature-x'))).toBe(true)
      expect(mockConnectToDatabase).not.toHaveBeenCalled()
      expect(jsonMessages[0]).toMatchObject({ target: 'feature-x' })
    })

    test('throws a helpful error when the branch endpoint 404s', async () => {
      setupFetchRouter({ siteDatabase: { connection_string: PROD_CONN } })

      await expect(statusDb({ branch: 'feature-x' }, createMockCommand())).rejects.toThrow(
        'No database branch found for "feature-x"',
      )
    })

    test('filters migrations to applied=true only', async () => {
      setupFetchRouter({
        siteDatabase: { connection_string: PROD_CONN },
        branch: { 'feature-x': { connection_string: BRANCH_CONN } },
        migrations: {
          'feature-x': [
            { version: 1, name: '0001_a', path: '0001_a/migration.sql', applied: true },
            { version: 2, name: '0002_b', path: '0002_b/migration.sql', applied: false },
          ],
        },
      })
      mockFS(migrationsTree(['0001_a', '0002_b', '0003_c']))

      await statusDb({ branch: 'feature-x', json: true }, createMockCommand())

      expect(jsonMessages[0]).toMatchObject({
        applied: [{ version: 1, name: '0001_a' }],
        pending: [
          { version: 2, name: '0002_b' },
          { version: 3, name: '0003_c' },
        ],
      })
    })

    test('uses branch connection string for display (redacted by default)', async () => {
      setupFetchRouter({
        siteDatabase: { connection_string: PROD_CONN },
        branch: { 'feature-x': { connection_string: BRANCH_CONN } },
        migrations: { 'feature-x': [] },
      })

      await statusDb({ branch: 'feature-x', json: true }, createMockCommand())

      expect(jsonMessages[0]).toMatchObject({
        database: { connectionString: 'postgres://***:***@branch-host.neon.tech/db' },
      })
    })

    test('does not show the apply-command hint for remote', async () => {
      setupFetchRouter({
        siteDatabase: { connection_string: PROD_CONN },
        branch: { 'feature-x': { connection_string: BRANCH_CONN } },
        migrations: { 'feature-x': [] },
      })
      mockFS(migrationsTree(['0001_a']))

      await statusDb({ branch: 'feature-x' }, createMockCommand())

      expect(logMessages.join('\n')).not.toContain('netlify database migrations apply')
    })

    test('falls back to NETLIFY_DB_BRANCH env var when --branch is not passed', async () => {
      process.env.NETLIFY_DB_BRANCH = 'feature-env'
      setupFetchRouter({
        siteDatabase: { connection_string: PROD_CONN },
        branch: { 'feature-env': { connection_string: BRANCH_CONN } },
        migrations: { 'feature-env': [] },
      })

      await statusDb({ json: true }, createMockCommand())

      expect(jsonMessages[0]).toMatchObject({ target: 'feature-env' })
      expect(mockConnectToDatabase).not.toHaveBeenCalled()
    })

    test('--branch wins over NETLIFY_DB_BRANCH when both are set', async () => {
      process.env.NETLIFY_DB_BRANCH = 'env-branch'
      setupFetchRouter({
        siteDatabase: { connection_string: PROD_CONN },
        branch: { 'flag-branch': { connection_string: BRANCH_CONN } },
        migrations: { 'flag-branch': [] },
      })

      await statusDb({ branch: 'flag-branch', json: true }, createMockCommand())

      expect(jsonMessages[0]).toMatchObject({ target: 'flag-branch' })
    })
  })
})
