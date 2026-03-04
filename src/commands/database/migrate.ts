import path from 'node:path'

import { log } from '../../utils/command-helpers.js'
import BaseCommand from '../base-command.js'

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

  const dbDirectory = path.join(buildDir, '.netlify', 'db')

  // TODO: We should grab the db from the `NetlifyDev` instance, so this type
  // would go away.
  let dbDev: {
    NetlifyDB: new (opts: { directory: string }) => {
      start(): Promise<string>
      stop(): Promise<void>
      applyMigrations(migrationsDirectory: string, target?: string): Promise<string[]>
    }
  }

  try {
    dbDev = await import('@netlify/db-dev')
  } catch {
    throw new Error(
      'The @netlify/db-dev package is required for local database migrations. Install it with: npm install @netlify/db-dev',
    )
  }

  const db = new dbDev.NetlifyDB({ directory: dbDirectory })

  try {
    await db.start()

    const applied = await db.applyMigrations(migrationsDirectory, name)

    if (json) {
      log(JSON.stringify({ migrations_applied: applied }))
    } else if (applied.length === 0) {
      log('No pending migrations to apply.')
    } else {
      log(`Applied ${String(applied.length)} migration${applied.length === 1 ? '' : 's'}:`)
      for (const migration of applied) {
        log(`  - ${migration}`)
      }
    }
  } finally {
    await db.stop()
  }
}
