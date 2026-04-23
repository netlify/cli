import { rm, mkdir, writeFile } from 'fs/promises'
import { dirname, resolve, isAbsolute } from 'path'

import inquirer from 'inquirer'

import { log, logJson } from '../../utils/command-helpers.js'
import execa from '../../utils/execa.js'
import BaseCommand from '../base-command.js'
import { PRODUCTION_BRANCH } from './util/constants.js'
import { resolveMigrationsDirectory } from './util/migrations-path.js'

export interface MigrationPullOptions {
  branch?: string | true
  force?: boolean
  json?: boolean
}

interface MigrationListItem {
  version: number
  name: string
  path: string
  applied: boolean
}

interface ListMigrationsResponse {
  migrations: MigrationListItem[]
}

interface MigrationDetailResponse {
  version: number
  name: string
  path: string
  content: string
}

interface ApiContext {
  siteId: string
  token: string
  basePath: string
}

const getLocalGitBranch = async (): Promise<string> => {
  const { stdout } = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
  const branch = stdout.trim()
  if (!branch || branch === 'HEAD') {
    throw new Error('Could not determine the current git branch. Are you in a detached HEAD state?')
  }
  return branch
}

const resolveBranch = async (branchOption: string | true | undefined): Promise<string | undefined> => {
  if (branchOption === undefined) {
    return undefined
  }
  if (branchOption === true) {
    return getLocalGitBranch()
  }
  return branchOption
}

const getApiContext = (command: BaseCommand): ApiContext => {
  const siteId = command.siteId
  if (!siteId) {
    throw new Error('The project must be linked with netlify link before pulling migrations.')
  }

  const accessToken = command.netlify.api.accessToken
  if (!accessToken) {
    throw new Error('You must be logged in with netlify login to pull migrations.')
  }

  return {
    siteId,
    token: accessToken.replace('Bearer ', ''),
    basePath: command.netlify.api.basePath,
  }
}

const fetchMigrations = async (ctx: ApiContext, branch: string | undefined): Promise<MigrationListItem[]> => {
  const url = new URL(`${ctx.basePath}/sites/${encodeURIComponent(ctx.siteId)}/database/migrations`)
  if (branch) {
    url.searchParams.set('branch', branch)
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${ctx.token}` },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to fetch migrations (${String(response.status)}): ${text}`)
  }

  const data = (await response.json()) as ListMigrationsResponse
  return data.migrations
}

const fetchMigrationContent = async (ctx: ApiContext, name: string, branch: string | undefined): Promise<string> => {
  const url = new URL(
    `${ctx.basePath}/sites/${encodeURIComponent(ctx.siteId)}/database/migrations/${encodeURIComponent(name)}`,
  )
  if (branch) {
    url.searchParams.set('branch', branch)
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${ctx.token}` },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to fetch content for migration "${name}" (${String(response.status)}): ${text}`)
  }

  const data = (await response.json()) as MigrationDetailResponse
  return data.content
}

export const migrationPull = async (options: MigrationPullOptions, command: BaseCommand) => {
  const { force, json } = options

  const branch = (await resolveBranch(options.branch)) ?? process.env.NETLIFY_DB_BRANCH
  const source = branch ?? PRODUCTION_BRANCH
  const ctx = getApiContext(command)
  const migrations = await fetchMigrations(ctx, branch)

  if (migrations.length === 0) {
    if (json) {
      logJson({ migrations_pulled: 0, branch: source })
    } else {
      log(`No migrations found for ${source}.`)
    }
    return
  }

  const migrationsDirectory = resolveMigrationsDirectory(command)
  const canonicalMigrationsDir = resolve(migrationsDirectory)

  const resolvedPaths = migrations.map((migration) => {
    if (isAbsolute(migration.path) || migration.path.split(/[/\\]/).includes('..')) {
      throw new Error(`Migration path "${migration.path}" contains invalid path segments.`)
    }
    const filePath = resolve(canonicalMigrationsDir, migration.path)
    if (!filePath.startsWith(canonicalMigrationsDir)) {
      throw new Error(`Migration path "${migration.path}" resolves outside the migrations directory.`)
    }
    return filePath
  })

  if (!force) {
    const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
      {
        type: 'confirm',
        name: 'confirmed',
        message: `This will overwrite all local migrations in ${migrationsDirectory} with ${String(
          migrations.length,
        )} migration${migrations.length === 1 ? '' : 's'} from ${source}. Continue?`,
        default: false,
      },
    ])

    if (!confirmed) {
      log('Pull cancelled.')
      return
    }
  }

  const contents = await Promise.all(migrations.map((migration) => fetchMigrationContent(ctx, migration.name, branch)))

  await rm(canonicalMigrationsDir, { recursive: true, force: true })

  for (const [index, filePath] of resolvedPaths.entries()) {
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, contents[index])
  }

  if (json) {
    logJson({
      migrations_pulled: migrations.length,
      branch: source,
      migrations: migrations.map((m) => m.name),
    })
  } else {
    log(`Pulled ${String(migrations.length)} migration${migrations.length === 1 ? '' : 's'} from ${source}:`)
    for (const migration of migrations) {
      log(`  - ${migration.name}`)
    }
  }
}
