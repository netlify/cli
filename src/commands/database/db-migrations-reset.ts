import { readdir, rm } from 'fs/promises'
import { join } from 'path'

import { chalk, log, logJson, netlifyCommand } from '../../utils/command-helpers.js'
import BaseCommand from '../base-command.js'
import { localAppliedMigrations, remoteAppliedMigrations } from './util/applied-migrations.js'
import { PRODUCTION_BRANCH } from './util/constants.js'
import { connectToDatabase } from './util/db-connection.js'
import { resolveMigrationsDirectory } from './util/migrations-path.js'

export interface MigrationsResetOptions {
  branch?: string
  json?: boolean
}

const SQL_EXTENSION = '.sql'

interface LocalMigration {
  // Name as stored in the tracking table — the directory name for directory-
  // style migrations, or the filename with `.sql` stripped for flat files.
  name: string
  // Absolute path on disk (directory or file).
  path: string
}

export const migrationsReset = async (options: MigrationsResetOptions, command: BaseCommand) => {
  const branch = options.branch ?? process.env.NETLIFY_DB_BRANCH
  const json = options.json ?? false

  if (branch) {
    if (branch === PRODUCTION_BRANCH) {
      throw new Error(
        `Refusing to target the production branch. ${chalk.bold(
          'db migrations reset',
        )} against a remote branch is only for preview branches.`,
      )
    }
    await resetAgainstBranch(branch, json, command)
    return
  }

  await resetAgainstLocal(json, command)
}

const resetAgainstLocal = async (json: boolean, command: BaseCommand): Promise<void> => {
  const buildDir = command.netlify.site.root ?? command.project.root ?? command.project.baseDirectory
  if (!buildDir) {
    throw new Error('Could not determine the project root directory.')
  }

  const migrationsDirectory = resolveMigrationsDirectory(command)

  if (!json) {
    log('Removing local migration files that have not been applied to the local development database.')
  }

  const { executor, cleanup } = await connectToDatabase(buildDir)

  let deleted: string[]
  try {
    const applied = await localAppliedMigrations({ executor })()
    const appliedNames = new Set(applied.map((m) => m.name))
    deleted = await deletePendingMigrationFiles(migrationsDirectory, appliedNames)
  } finally {
    await cleanup()
  }

  logOutcome(deleted, { json, target: 'local' })
}

const resetAgainstBranch = async (branch: string, json: boolean, command: BaseCommand): Promise<void> => {
  const siteId = command.siteId
  const accessToken = command.netlify.api.accessToken
  const basePath = command.netlify.api.basePath

  if (!siteId) {
    throw new Error(`The project must be linked with ${netlifyCommand()} link to target a remote branch.`)
  }
  if (!accessToken) {
    throw new Error(`You must be logged in with ${netlifyCommand()} login to target a remote branch.`)
  }

  const migrationsDirectory = resolveMigrationsDirectory(command)

  if (!json) {
    log(
      `Removing local migration files that have not been applied to database branch ${chalk.bold(branch)}. ` +
        'Files that are already applied to the branch are kept untouched.',
    )
  }

  const applied = await remoteAppliedMigrations({ siteId, accessToken, basePath, branch })()
  const appliedNames = new Set(applied.map((m) => m.name))

  const deleted = await deletePendingMigrationFiles(migrationsDirectory, appliedNames)

  logOutcome(deleted, { json, target: 'branch', branch })
}

const logOutcome = (
  deleted: string[],
  params: { json: boolean; target: 'local' | 'branch'; branch?: string },
): void => {
  if (params.json) {
    logJson({
      reset: true,
      target: params.target,
      ...(params.branch ? { branch: params.branch } : {}),
      pendingMigrationFilesDeleted: deleted,
    })
    return
  }

  if (deleted.length === 0) {
    log('No pending migration files to delete — all local migrations are already applied.')
    return
  }
  log(`Deleted ${String(deleted.length)} pending migration file(s):`)
  for (const name of deleted) {
    log(`  • ${name}`)
  }
}

const deletePendingMigrationFiles = async (
  migrationsDirectory: string,
  appliedNames: Set<string>,
): Promise<string[]> => {
  const local = await readLocalMigrations(migrationsDirectory)
  const pending = local.filter((m) => !appliedNames.has(m.name))
  for (const migration of pending) {
    await rm(migration.path, { recursive: true, force: true })
  }
  return pending.map((m) => m.name)
}

const readLocalMigrations = async (migrationsDirectory: string): Promise<LocalMigration[]> => {
  let entries
  try {
    entries = await readdir(migrationsDirectory, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw error
  }

  const migrations: LocalMigration[] = []
  for (const entry of entries) {
    const entryPath = join(migrationsDirectory, entry.name)
    if (entry.isDirectory()) {
      migrations.push({ name: entry.name, path: entryPath })
    } else if (entry.isFile() && entry.name.endsWith(SQL_EXTENSION)) {
      migrations.push({ name: entry.name.slice(0, -SQL_EXTENSION.length), path: entryPath })
    }
  }
  return migrations
}
