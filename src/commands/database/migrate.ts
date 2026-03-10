import { applyMigrations } from '@netlify/db-dev'

import { log, logJson } from '../../utils/command-helpers.js'
import BaseCommand from '../base-command.js'
import { connectToDatabase } from './db-connection.js'

export interface MigrateOptions {
  to?: string
  json?: boolean
}

export const migrate = async (options: MigrateOptions, command: BaseCommand) => {
  const { to: name, json } = options
  const buildDir = command.netlify.site.root ?? command.project.root ?? command.project.baseDirectory
  if (!buildDir) {
    throw new Error('Could not determine the project root directory.')
  }

  const migrationsDirectory = command.netlify.config.db?.migrations?.path
  if (!migrationsDirectory) {
    throw new Error(
      'No migrations directory found. Create a directory at netlify/db/migrations or set `db.migrations.path` in `netlify.toml`.',
    )
  }

  const { executor, cleanup } = await connectToDatabase(buildDir)

  try {
    const applied = await applyMigrations(executor, migrationsDirectory, name)

    if (json) {
      logJson({ migrations_applied: applied })
    } else if (applied.length === 0) {
      log('No pending migrations to apply.')
    } else {
      log(`Applied ${String(applied.length)} migration${applied.length === 1 ? '' : 's'}:`)
      for (const migration of applied) {
        log(`  - ${migration}`)
      }
    }
  } finally {
    await cleanup()
  }
}
