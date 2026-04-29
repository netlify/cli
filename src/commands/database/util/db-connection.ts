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

// Unwraps AggregateError's inner errors into a single readable string. pg's
// connection errors show up this way when the server resolves to multiple
// addresses (IPv4/IPv6) and every attempt fails — the outer message is empty
// without this.
export const describeError = (err: unknown): string => {
  if (err && typeof err === 'object' && 'errors' in err && Array.isArray((err as AggregateError).errors)) {
    const inner = (err as AggregateError).errors
      .map((e) => (e instanceof Error ? e.message : String(e)))
      .filter((msg) => msg.length > 0)
    if (inner.length > 0) return inner.join('; ')
  }
  if (err instanceof Error) return err.message || err.name || 'unknown error'
  return String(err)
}

// Detects pg "can't reach the server" errors. pg wraps multi-address attempts
// (IPv4 + IPv6) in an AggregateError whose outer message is empty, so we also
// unwrap .errors when present.
function isConnectionUnreachableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = (err as NodeJS.ErrnoException).code
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EHOSTUNREACH') return true
  if ('errors' in err && Array.isArray((err as AggregateError).errors)) {
    return (err as AggregateError).errors.some(isConnectionUnreachableError)
  }
  return false
}

export async function connectRawClient(buildDir: string, urlOverride?: string): Promise<RawDBConnection> {
  const existing = urlOverride ?? detectExistingLocalConnectionString(buildDir)
  // Explicit overrides (NETLIFY_DB_URL env var, or a urlOverride argument) are
  // user-supplied and should never be silently discarded on a connection
  // failure — let the error propagate. A persisted `dbConnectionString` in
  // LocalState is different: it's a stale record of a prior `netlify dev` run
  // that may not be running anymore, and we should recover by falling back to
  // starting a fresh NetlifyDev.
  const isUserOverride = Boolean(urlOverride ?? process.env.NETLIFY_DB_URL)

  if (existing) {
    try {
      const client = new Client({ connectionString: existing })
      await client.connect()
      return {
        client,
        connectionString: existing,
        cleanup: () => client.end(),
      }
    } catch (err) {
      if (isUserOverride || !isConnectionUnreachableError(err)) {
        throw err
      }
      // Persisted connection string points at a port that nothing is listening
      // on. Drop the stale record so subsequent calls don't hit the same dead
      // end, and fall through to the NetlifyDev.start() path.
      new LocalState(buildDir).delete('dbConnectionString')
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
    throw new Error('Local database failed to start.')
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
