import { readFile, readdir } from 'fs/promises'
import { join } from 'path'

import { chalk, log, logJson, netlifyCommand } from '../../utils/command-helpers.js'
import BaseCommand from '../base-command.js'
import {
  type AppliedMigrationsFetcher,
  localAppliedMigrations,
  type MigrationFile,
  remoteAppliedMigrations,
} from './util/applied-migrations.js'
import { connectToDatabase, detectExistingLocalConnectionString } from './util/db-connection.js'
import { resolveMigrationsDirectory } from './util/migrations-path.js'
import { fileExistsAsync } from '../../lib/fs.js'

export interface DatabaseStatusOptions {
  branch?: string
  showCredentials?: boolean
  json?: boolean
}

interface MigrationEntry {
  version: number
  name: string
}

interface OutOfOrderEntry extends MigrationEntry {
  maxApplied: number
}

interface MigrationsStatus {
  applied: MigrationEntry[]
  pending: MigrationEntry[]
  missingOnDisk: MigrationEntry[]
  outOfOrder: OutOfOrderEntry[]
}

interface ServerContext {
  siteId: string
  accessToken: string
  basePath: string
}

const DOCS_URL = 'https://ntl.fyi/database'
const NETLIFY_DATABASE_PACKAGE = '@netlify/database'

const formatCommand = (suffix: string): string => chalk.cyanBright.bold(`${netlifyCommand()} ${suffix}`)

const logConnectCommands = () => {
  secondary(`Run ${formatCommand('database connect')} to start an interactive database client`)
  secondary(`Run ${formatCommand('database connect --query "<SQL>"')} to run a one-shot query`)
}

const parseVersion = (name: string): number | null => {
  const match = /^(\d+)_/.exec(name)
  if (!match) {
    return null
  }
  const parsed = Number.parseInt(match[1], 10)
  return Number.isFinite(parsed) ? parsed : null
}

const MIGRATION_NAME_PATTERN = /^\d+_[a-z0-9_-]+$/

const readLocalMigrations = async (migrationsDirectory: string): Promise<MigrationEntry[]> => {
  let entries
  try {
    entries = await readdir(migrationsDirectory, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw error
  }

  // First pass is to extract migration names
  const migrationNames: string[] = []
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (
        MIGRATION_NAME_PATTERN.test(entry.name) &&
        (await fileExistsAsync(join(migrationsDirectory, entry.name, 'migration.sql')))
      ) {
        migrationNames.push(entry.name)
      }
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.sql')) {
      const migrationName = entry.name.replace(/\.sql$/, '')
      if (MIGRATION_NAME_PATTERN.test(migrationName)) {
        migrationNames.push(migrationName)
      }
    }
  }
  // Second pass to parse version and create migration entries
  const migrations: MigrationEntry[] = []
  for (const migrationName of migrationNames) {
    const version = parseVersion(migrationName)
    if (version === null) {
      continue
    }
    migrations.push({ name: migrationName, version })
  }
  migrations.sort((a, b) => a.version - b.version)
  return migrations
}

const toEntry = (m: MigrationFile): MigrationEntry => ({ version: m.version, name: m.name })

export const computeStatus = (applied: MigrationFile[], local: MigrationEntry[]): MigrationsStatus => {
  const appliedEntries = applied.map(toEntry)
  const appliedByName = new Map(appliedEntries.map((m) => [m.name, m]))
  const localByName = new Map(local.map((m) => [m.name, m]))

  const pending = local.filter((m) => !appliedByName.has(m.name))
  const missingOnDisk = appliedEntries.filter((m) => !localByName.has(m.name))

  const maxApplied = appliedEntries.reduce((max, m) => (m.version > max ? m.version : max), 0)
  const outOfOrder: OutOfOrderEntry[] = pending
    .filter((m) => m.version <= maxApplied)
    .map((m) => ({ name: m.name, version: m.version, maxApplied }))

  return { applied: appliedEntries, pending, missingOnDisk, outOfOrder }
}

const redactConnectionString = (connectionString: string): string => {
  try {
    const url = new URL(connectionString)
    if (url.username) {
      url.username = '***'
    }
    if (url.password) {
      url.password = '***'
    }
    return url.toString()
  } catch {
    return '***'
  }
}

const connectionStringHasCredentials = (connectionString: string): boolean => {
  try {
    const url = new URL(connectionString)
    return Boolean(url.username || url.password)
  } catch {
    return false
  }
}

const isNetlifyDatabasePackageInstalled = async (projectRoot: string): Promise<boolean> => {
  try {
    const raw = await readFile(`${projectRoot}/package.json`, 'utf-8')
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    return Boolean(pkg.dependencies?.[NETLIFY_DATABASE_PACKAGE] ?? pkg.devDependencies?.[NETLIFY_DATABASE_PACKAGE])
  } catch {
    return false
  }
}

const fetchBranchConnectionString = async (ctx: ServerContext, branchId: string): Promise<string> => {
  const token = ctx.accessToken.replace('Bearer ', '')
  const url = new URL(
    `${ctx.basePath}/sites/${encodeURIComponent(ctx.siteId)}/database/branch/${encodeURIComponent(branchId)}`,
  )

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (response.status === 404) {
    throw new Error(`No database branch found for "${branchId}". Has a deploy been published for this branch?`)
  }

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to fetch database branch "${branchId}" (${String(response.status)}): ${text}`)
  }

  const data = (await response.json()) as { connection_string?: string }
  if (!data.connection_string) {
    throw new Error(`Database branch "${branchId}" has no connection string.`)
  }
  return data.connection_string
}

const fetchSiteDatabase = async (ctx: ServerContext): Promise<{ connectionString: string } | null> => {
  const token = ctx.accessToken.replace('Bearer ', '')
  const url = new URL(`${ctx.basePath}/sites/${encodeURIComponent(ctx.siteId)}/database/`)

  let response: Response
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  } catch {
    return null
  }

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    return null
  }

  const data = (await response.json()) as { connection_string?: string }
  if (!data.connection_string) {
    return null
  }
  return { connectionString: data.connection_string }
}

const renderList = (items: MigrationEntry[]): string => {
  if (items.length === 0) {
    return chalk.dim('  (none)')
  }
  return items.map((m) => `  • ${m.name}`).join('\n')
}

interface RenderParams {
  enabled: boolean
  packageInstalled: boolean
  branchLabel: string
  connectionString: string | null
  showCredentials: boolean
  status: MigrationsStatus
  isLocal: boolean
  adminUrl?: string
}

// INDENT clears the emoji column so secondary lines hang under the primary
// text. Width: 2-space section indent + 2-col emoji + 1 space = 5.
const INDENT = '     '
const STATUS_GOOD = '🟢'
const STATUS_WARN = '🟡'
const STATUS_PAUSED = '⏸️ '

const primary = (emoji: string, text: string): void => {
  log(`  ${emoji} ${text}`)
}

const secondary = (text: string): void => {
  log(chalk.gray(`${INDENT}${text}`))
}

const renderPretty = (params: RenderParams) => {
  const { enabled, packageInstalled, connectionString, showCredentials, status, isLocal, adminUrl } = params

  log(chalk.bold('Netlify Database'))
  log(chalk.gray('Managed Postgres databases that seamlessly integrate with the Netlify workflow'))
  log('')

  if (enabled) {
    primary(STATUS_GOOD, 'Netlify Database is enabled for this project')
    if (adminUrl) {
      secondary(`Manage your database at ${adminUrl}/database`)
    }
  } else {
    primary(STATUS_WARN, 'Netlify Database is not enabled for this project')
    secondary(`Install the ${chalk.bold(NETLIFY_DATABASE_PACKAGE)} package and deploy your site to automatically`)
    secondary(`provision a database. Refer to ${DOCS_URL} for more information.`)
  }
  log('')

  if (packageInstalled) {
    primary(STATUS_GOOD, `The ${chalk.bold(NETLIFY_DATABASE_PACKAGE)} package is installed`)
    secondary(`For a full API reference, visit ${DOCS_URL}`)
  } else {
    primary(STATUS_WARN, `The ${chalk.bold(NETLIFY_DATABASE_PACKAGE)} package is not installed`)
    secondary(`Install it with \`npm install ${NETLIFY_DATABASE_PACKAGE}\``)
    secondary(`Refer to ${DOCS_URL} for more information`)
  }
  log('')

  if (connectionString) {
    const displayed = showCredentials ? connectionString : redactConnectionString(connectionString)

    primary(STATUS_GOOD, `Connected to database branch: ${displayed}`)
    logConnectCommands()

    if (!showCredentials && connectionStringHasCredentials(connectionString)) {
      secondary(
        `To reveal the full connection string (including credentials), run ${formatCommand(
          'database status --show-credentials',
        )}`,
      )
    } else {
      secondary(`To connect to the database directly, use the connection string: ${displayed}`)
    }
  } else if (isLocal) {
    primary(STATUS_PAUSED, 'The local database is not running')
    secondary(
      `It starts automatically when you run ${formatCommand(
        'dev',
      )}. Run that in a new terminal and try this command again`,
    )
    logConnectCommands()
  }

  log('')
  log(chalk.bold('Applied migrations'))
  log(chalk.gray('Migrations that have been applied to the database branch'))
  log('')
  log(renderList(status.applied))
  log('')
  log(
    chalk.gray(
      'Note that these migrations cannot be removed or edited. To change anything, you should generate a new migration.',
    ),
  )

  log('')
  log(chalk.bold('Migrations not applied'))
  log(chalk.gray("Migrations that exist locally that haven't yet been applied"))
  log('')
  log(renderList(status.pending))
  if (isLocal && status.pending.length > 0 && status.outOfOrder.length === 0) {
    log('')
    log(chalk.gray(`Run ${formatCommand('database migrations apply')} to apply these to the local database.`))
  }

  if (status.missingOnDisk.length > 0 || status.outOfOrder.length > 0) {
    log('')
    log(chalk.bold.yellow('Issues'))
    if (status.missingOnDisk.length > 0) {
      log(`  Applied but missing on disk: ${status.missingOnDisk.map((m) => chalk.red(m.name)).join(', ')}`)
    }
    if (status.outOfOrder.length > 0) {
      log(
        `  Out of order: ${status.outOfOrder
          .map((m) => chalk.red(`${m.name} (version ${String(m.version)} <= max applied ${String(m.maxApplied)})`))
          .join(', ')}`,
      )
      log('')
      log(
        chalk.gray(
          `Run ${formatCommand(
            'database migrations reset',
          )} to delete these local-only migrations, then generate them again with a higher prefix.`,
        ),
      )
    }
  }
}

export const statusDb = async (options: DatabaseStatusOptions, command: BaseCommand) => {
  const buildDir = command.netlify.site.root ?? command.project.root ?? command.project.baseDirectory
  if (!buildDir) {
    throw new Error('Could not determine the project root directory.')
  }

  const migrationsDirectory = resolveMigrationsDirectory(command)
  const local = await readLocalMigrations(migrationsDirectory)
  const packageInstalled = await isNetlifyDatabasePackageInstalled(buildDir)

  const siteId = command.siteId
  const accessToken = command.netlify.api.accessToken
  const basePath = command.netlify.api.basePath

  // Enabled check: NETLIFY_DB_URL env OR site has a database configured.
  const envUrl = process.env.NETLIFY_DB_URL
  let siteHasDatabase = false
  if (siteId && accessToken) {
    const siteDb = await fetchSiteDatabase({ siteId, accessToken, basePath })
    siteHasDatabase = siteDb !== null
  }
  const enabled = Boolean(envUrl) || siteHasDatabase

  // `--branch` can also be supplied via the NETLIFY_DB_BRANCH env var.
  const branch = options.branch ?? process.env.NETLIFY_DB_BRANCH

  // Resolve what database we're looking at and how to fetch applied migrations.
  let branchLabel: string
  let connectionString: string | null = null
  let fetchApplied: AppliedMigrationsFetcher
  let cleanup: (() => Promise<void>) | undefined
  let isLocal = false

  if (branch) {
    if (!siteId) {
      throw new Error(`The project must be linked with ${netlifyCommand()} link to target a remote branch.`)
    }
    if (!accessToken) {
      throw new Error(`You must be logged in with ${netlifyCommand()} login to target a remote branch.`)
    }

    connectionString = await fetchBranchConnectionString({ siteId, accessToken, basePath }, branch)
    fetchApplied = remoteAppliedMigrations({ siteId, accessToken, basePath, branch })
    branchLabel = branch
  } else {
    isLocal = true
    branchLabel = 'local'

    // If a local database is already running, its connection string is stable
    // and safe to print. Otherwise we still connect (connectToDatabase starts
    // one up) so we can read migration state — we just suppress the
    // connection string in the output because it dies with this process.
    const existing = detectExistingLocalConnectionString(buildDir)
    const connection = await connectToDatabase(buildDir)
    cleanup = connection.cleanup
    fetchApplied = localAppliedMigrations({ executor: connection.executor })
    if (existing) {
      connectionString = connection.connectionString
    }
  }

  let status: MigrationsStatus
  try {
    const applied = await fetchApplied()
    status = computeStatus(applied, local)
  } finally {
    if (cleanup) {
      await cleanup()
    }
  }

  if (options.json) {
    const displayedConnection = connectionString
      ? options.showCredentials
        ? connectionString
        : redactConnectionString(connectionString)
      : null
    logJson({
      enabled,
      packageInstalled,
      target: branchLabel,
      database: displayedConnection === null ? null : { connectionString: displayedConnection },
      applied: status.applied.map((m) => ({ version: m.version, name: m.name })),
      pending: status.pending.map((m) => ({ version: m.version, name: m.name })),
      missingOnDisk: status.missingOnDisk.map((m) => ({ version: m.version, name: m.name })),
      outOfOrder: status.outOfOrder,
    })
    return
  }

  const siteInfo = command.netlify.siteInfo as { admin_url?: string } | undefined
  renderPretty({
    enabled,
    packageInstalled,
    branchLabel,
    connectionString,
    showCredentials: options.showCredentials ?? false,
    status,
    isLocal,
    adminUrl: siteInfo?.admin_url,
  })
}
