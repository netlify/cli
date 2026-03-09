import { NetlifyDev } from '@netlify/dev'

import { log, logJson } from '../../utils/command-helpers.js'
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

  const runningDbUrl = command.netlify.state.get('db.url') as string | undefined
  const netlifyDev = new NetlifyDev({
    projectRoot: buildDir,
    aiGateway: { enabled: false },
    blobs: { enabled: false },
    edgeFunctions: { enabled: false },
    environmentVariables: { enabled: false },
    functions: { enabled: false },
    geolocation: { enabled: false },
    headers: { enabled: false },
    images: { enabled: false },
    redirects: { enabled: false },
    staticFiles: { enabled: false },
    serverAddress: null,
    ...(runningDbUrl ? { db: { connectionString: runningDbUrl } } : {}),
  })

  try {
    await netlifyDev.start()

    const { db } = netlifyDev
    if (!db) {
      throw new Error('Local database failed to start. Set EXPERIMENTAL_NETLIFY_DB_ENABLED=1 to enable.')
    }

    const applied = await db.applyMigrations(migrationsDirectory, name)
    logAppliedMigrations(applied, json)
  } finally {
    await netlifyDev.stop()
  }
}

function logAppliedMigrations(applied: string[], json?: boolean) {
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
}
