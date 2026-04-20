import { type SQLExecutor } from '@netlify/dev'

import { MIGRATIONS_TABLE } from './constants.js'

export interface MigrationFile {
  version: number
  name: string
  path: string
}

export type AppliedMigrationsFetcher = () => Promise<MigrationFile[]>

const MIGRATION_FILE_NAME = 'migration.sql'

const parseVersion = (name: string): number | null => {
  const match = /^(\d+)[_-]/.exec(name)
  if (!match) {
    return null
  }
  const parsed = Number.parseInt(match[1], 10)
  return Number.isFinite(parsed) ? parsed : null
}

interface RemoteOptions {
  siteId: string
  accessToken: string
  basePath: string
  branch: string
}

interface RemoteMigration {
  version: number
  name: string
  path: string
  applied: boolean
}

interface ListMigrationsResponse {
  migrations: RemoteMigration[]
}

export const remoteAppliedMigrations =
  (options: RemoteOptions): AppliedMigrationsFetcher =>
  async () => {
    const token = options.accessToken.replace('Bearer ', '')
    const url = new URL(`${options.basePath}/sites/${encodeURIComponent(options.siteId)}/database/migrations`)
    url.searchParams.set('branch', options.branch)

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Failed to fetch applied migrations (${String(response.status)}): ${text}`)
    }

    const data = (await response.json()) as ListMigrationsResponse
    return data.migrations.filter((m) => m.applied).map((m) => ({ version: m.version, name: m.name, path: m.path }))
  }

interface LocalOptions {
  executor: SQLExecutor
}

export const localAppliedMigrations =
  (options: LocalOptions): AppliedMigrationsFetcher =>
  async () => {
    const { rows } = await options.executor.query<{ name: string }>(
      `SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY applied_at ASC, name ASC`,
    )

    const migrations: MigrationFile[] = []
    for (const row of rows) {
      const version = parseVersion(row.name)
      if (version === null) {
        continue
      }
      migrations.push({
        version,
        name: row.name,
        path: `${row.name}/${MIGRATION_FILE_NAME}`,
      })
    }
    return migrations
  }
