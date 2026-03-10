import path from 'node:path'

import { Client } from 'pg'

import { NetlifyDB } from '@netlify/db-dev'
import { LocalState } from '@netlify/dev-utils'

import { PgClientExecutor } from './pg-client-executor.js'

interface DBConnection {
  executor: PgClientExecutor
  cleanup: () => Promise<void>
}

export async function connectToDatabase(buildDir: string): Promise<DBConnection> {
  const state = new LocalState(buildDir)
  const connectionString = state.get('dbConnectionString')

  if (!connectionString) {
    const dbDirectory = path.join(buildDir, '.netlify', 'db')
    const db = new NetlifyDB({ directory: dbDirectory })
    const newConnectionString = await db.start()

    const client = new Client({ connectionString: newConnectionString })
    await client.connect()
    return {
      executor: new PgClientExecutor(client),
      cleanup: async () => {
        await client.end()
        await db.stop()
      },
    }
  }

  const client = new Client({ connectionString })
  await client.connect()
  return {
    executor: new PgClientExecutor(client),
    cleanup: () => client.end(),
  }
}
