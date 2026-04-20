import { Client } from 'pg'

import { NetlifyDev, type SQLExecutor } from '@netlify/dev'
import { LocalState } from '@netlify/dev-utils'

import { PgClientExecutor } from './pg-client-executor.js'

interface DBConnection {
  executor: SQLExecutor
  connectionString: string
  cleanup: () => Promise<void>
}

export async function connectToDatabase(buildDir: string, urlOverride?: string): Promise<DBConnection> {
  const { client, connectionString, cleanup } = await connectRawClient(buildDir, urlOverride)
  return {
    executor: new PgClientExecutor(client),
    connectionString,
    cleanup,
  }
}

interface RawDBConnection {
  client: Client
  connectionString: string
  cleanup: () => Promise<void>
}

// detectExistingLocalConnectionString returns a connection string for an
// already-available local database (either the NETLIFY_DB_URL env override or
// the connection string persisted by a running local dev session) without
// starting a new dev database. Returns null when nothing's currently
// available — callers should decide whether starting one is worth the cost.
export function detectExistingLocalConnectionString(buildDir: string): string | null {
  if (process.env.NETLIFY_DB_URL) {
    return process.env.NETLIFY_DB_URL
  }
  const state = new LocalState(buildDir)
  const stored = state.get('dbConnectionString')
  return stored ?? null
}

export async function connectRawClient(buildDir: string, urlOverride?: string): Promise<RawDBConnection> {
  const existing = urlOverride ?? detectExistingLocalConnectionString(buildDir)
  if (existing) {
    const client = new Client({ connectionString: existing })
    await client.connect()
    return {
      client,
      connectionString: existing,
      cleanup: () => client.end(),
    }
  }

  const state = new LocalState(buildDir)

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

  const connectionString = state.get('dbConnectionString')
  if (!connectionString) {
    await netlifyDev.stop()
    throw new Error('Local database failed to start. Set EXPERIMENTAL_NETLIFY_DB_ENABLED=1 to enable.')
  }

  const client = new Client({ connectionString })
  await client.connect()

  return {
    client,
    connectionString,
    cleanup: async () => {
      await client.end()
      await netlifyDev.stop()
    },
  }
}
