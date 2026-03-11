import { Client } from 'pg'

import type { SQLExecutor } from '@netlify/dev'
import { NetlifyDev } from '@netlify/dev'
import { LocalState } from '@netlify/dev-utils'

import { PgClientExecutor } from './pg-client-executor.js'

interface DBConnection {
  executor: SQLExecutor
  cleanup: () => Promise<void>
}

export async function connectToDatabase(buildDir: string): Promise<DBConnection> {
  const state = new LocalState(buildDir)
  const connectionString = state.get('dbConnectionString')

  if (connectionString) {
    const client = new Client({ connectionString })
    await client.connect()
    return {
      executor: new PgClientExecutor(client),
      cleanup: () => client.end(),
    }
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

  await netlifyDev.start()

  const { db } = netlifyDev
  if (!db) {
    await netlifyDev.stop()
    throw new Error('Local database failed to start. Set EXPERIMENTAL_NETLIFY_DB_ENABLED=1 to enable.')
  }

  return {
    executor: db,
    cleanup: () => netlifyDev.stop(),
  }
}
