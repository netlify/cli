import { Client } from 'pg'

import { NetlifyDev, type SQLExecutor } from '@netlify/dev'
import { LocalState } from '@netlify/dev-utils'

import { PgClientExecutor } from './pg-client-executor.js'

interface DBConnection {
  executor: SQLExecutor
  cleanup: () => Promise<void>
}

export async function connectToDatabase(buildDir: string): Promise<DBConnection> {
  const { client, cleanup } = await connectRawClient(buildDir)
  return {
    executor: new PgClientExecutor(client),
    cleanup,
  }
}

interface RawDBConnection {
  client: Client
  connectionString: string
  cleanup: () => Promise<void>
}

export async function connectRawClient(buildDir: string): Promise<RawDBConnection> {
  const envConnectionString = process.env.NETLIFY_DB_URL
  if (envConnectionString) {
    const client = new Client({ connectionString: envConnectionString })
    await client.connect()
    return {
      client,
      connectionString: envConnectionString,
      cleanup: () => client.end(),
    }
  }

  const state = new LocalState(buildDir)
  const storedConnectionString = state.get('dbConnectionString')

  if (storedConnectionString) {
    const client = new Client({ connectionString: storedConnectionString })
    await client.connect()
    return {
      client,
      connectionString: storedConnectionString,
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
