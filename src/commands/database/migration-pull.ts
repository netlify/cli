import { rm, mkdir, writeFile } from 'fs/promises'
import { join, dirname } from 'path'

import inquirer from 'inquirer'

import { log, logJson } from '../../utils/command-helpers.js'
import execa from '../../utils/execa.js'
import BaseCommand from '../base-command.js'
import { resolveMigrationsDirectory } from './migration-new.js'

export interface MigrationPullOptions {
  branch?: string | true
  force?: boolean
  json?: boolean
}

interface MigrationFile {
  version: number
  name: string
  path: string
  content: string
}

interface ListMigrationsResponse {
  migrations: MigrationFile[]
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

const fetchMigrations = async (command: BaseCommand, branch: string | undefined): Promise<MigrationFile[]> => {
  const siteId = command.siteId
  if (!siteId) {
    throw new Error('The project must be linked with netlify link before pulling migrations.')
  }

  const accessToken = command.netlify.api.accessToken
  if (!accessToken) {
    throw new Error('You must be logged in with netlify login to pull migrations.')
  }

  const token = accessToken.replace('Bearer ', '')
  const basePath = command.netlify.api.basePath

  const url = new URL(`${basePath}/sites/${encodeURIComponent(siteId)}/database/migrations`)
  if (branch) {
    url.searchParams.set('branch', branch)
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to fetch migrations (${String(response.status)}): ${text}`)
  }

  const data = (await response.json()) as ListMigrationsResponse
  return data.migrations
}

export const migrationPull = async (options: MigrationPullOptions, command: BaseCommand) => {
  const { force, json } = options

  const branch = await resolveBranch(options.branch)
  const source = branch ?? 'production'
  const migrations = await fetchMigrations(command, branch)

  if (migrations.length === 0) {
    if (json) {
      logJson({ migrations_pulled: 0, branch: source })
    } else {
      log(`No migrations found for ${source}.`)
    }
    return
  }

  const migrationsDirectory = resolveMigrationsDirectory(command)

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

  await rm(migrationsDirectory, { recursive: true, force: true })

  for (const migration of migrations) {
    const filePath = join(migrationsDirectory, migration.path)
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, migration.content)
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
