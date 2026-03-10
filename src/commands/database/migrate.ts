import { Client } from 'pg'

import { applyMigrations } from '@netlify/db-dev'

import { PgClientExecutor } from './pg-client-executor.js'
import { NetlifyDev } from '@netlify/dev'
import { LocalState } from '@netlify/dev-utils'

import { log, logJson } from '../../utils/command-helpers.js'
import BaseCommand from '../base-command.js'

export interface MigrateOptions {
  to?: string
  json?: boolean
}

async function migrateViaRunningInstance(
  connectionString: string,
  migrationsDirectory: string,
  name?: string,
): Promise<string[]> {
  const client = new Client({ connectionString })
  await client.connect()
  try {
    const executor = new PgClientExecutor(client)
    return await applyMigrations(executor, migrationsDirectory, name)
  } finally {
    await client.end()
  }
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

  const state = new LocalState(buildDir)
  const connectionString = state.get('dbConnectionString')

  if (connectionString) {
    const applied = await migrateViaRunningInstance(connectionString, migrationsDirectory, name)
    logMigrationResult(applied, json)
    return
  }

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
  })

  try {
    await netlifyDev.start()

    const { db } = netlifyDev
    if (!db) {
      throw new Error('Local database failed to start. Set EXPERIMENTAL_NETLIFY_DB_ENABLED=1 to enable.')
    }

    const applied = await db.applyMigrations(migrationsDirectory, name)
    logMigrationResult(applied, json)
  } finally {
    await netlifyDev.stop()
  }
}

function logMigrationResult(applied: string[], json?: boolean) {
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
