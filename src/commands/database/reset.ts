import { Client } from 'pg'

import { resetDatabase } from '@netlify/db-dev'

import { PgClientExecutor } from './pg-client-executor.js'
import { NetlifyDev } from '@netlify/dev'
import { LocalState } from '@netlify/dev-utils'

import { log, logJson } from '../../utils/command-helpers.js'
import BaseCommand from '../base-command.js'

export interface ResetOptions {
  json?: boolean
}

async function resetViaRunningInstance(connectionString: string): Promise<void> {
  const client = new Client({ connectionString })
  await client.connect()
  try {
    const executor = new PgClientExecutor(client)
    await resetDatabase(executor)
  } finally {
    await client.end()
  }
}

export const reset = async (options: ResetOptions, command: BaseCommand) => {
  const { json } = options
  const buildDir = command.netlify.site.root ?? command.project.root ?? command.project.baseDirectory
  if (!buildDir) {
    throw new Error('Could not determine the project root directory.')
  }

  const state = new LocalState(buildDir)
  const connectionString = state.get('dbConnectionString')

  if (connectionString) {
    await resetViaRunningInstance(connectionString)
    logResetResult(json)
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

    await db.reset()
    logResetResult(json)
  } finally {
    await netlifyDev.stop()
  }
}

function logResetResult(json?: boolean) {
  if (json) {
    logJson({ reset: true })
  } else {
    log('Local development database has been reset.')
  }
}
