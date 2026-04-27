import { existsSync } from 'fs'
import { mkdir, readdir, writeFile } from 'fs/promises'
import { join } from 'path'

import { applyMigrations } from '@netlify/dev'
import inquirer from 'inquirer'

import { chalk, log, netlifyCommand } from '../../utils/command-helpers.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import { isInteractive } from '../../utils/scripted-commands.js'
import BaseCommand from '../base-command.js'
import { generateNextPrefix } from './db-migration-new.js'
import { connectRawClient, describeError } from './util/db-connection.js'
import {
  DRIZZLE_SCHEMA_TS,
  DRIZZLE_SEED_SQL,
  drizzleConfigTs,
  SEED_MIGRATION_NAME,
  STARTER_MIGRATION_NAME,
  STARTER_MIGRATION_SQL,
  STARTER_TABLE,
} from './util/init-data.js'
import { resolveMigrationsDirectory } from './util/migrations-path.js'
import { hasDependency } from './util/package-json.js'
import { getPackageManager, installPackages, type PackageEntry, type PmInfo } from './util/packages.js'
import { relativeToProject } from './util/paths.js'
import { PgClientExecutor } from './util/pg-client-executor.js'
import { formatQueryResult } from './util/psql-formatter.js'
import { spawnAsync } from './util/spawn-async.js'

export interface DatabaseInitOptions {
  yes?: boolean
}

const NETLIFY_DATABASE_PACKAGE = '@netlify/database'
const DRIZZLE_ORM_PACKAGE = 'drizzle-orm'
const DRIZZLE_KIT_PACKAGE = 'drizzle-kit'
const DOCS_URL = 'https://ntl.fyi/database'

type QueryStyle = 'raw' | 'drizzle'

const sectionHeading = (title: string): void => {
  log('')
  log(chalk.bold(title))
}

const info = (text: string): void => {
  log(chalk.gray(text))
}

const success = (text: string): void => {
  log(chalk.green(`✓ ${text}`))
}

const carefullyWriteFile = async (filePath: string, data: string, projectRoot: string) => {
  if (existsSync(filePath)) {
    type Answers = {
      overwrite: boolean
    }
    const answers = await inquirer.prompt<Answers>([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `Overwrite existing file .${filePath.replace(projectRoot, '')}?`,
      },
    ])
    if (answers.overwrite) {
      await writeFile(filePath, data)
    }
  } else {
    await writeFile(filePath, data)
  }
}

const readDirectoryEntries = async (dir: string): Promise<string[]> => {
  try {
    return await readdir(dir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

const promptForQueryStyle = async (interactive: boolean): Promise<QueryStyle> => {
  if (!interactive) {
    return 'drizzle'
  }

  log('')
  const { queryStyle } = await inquirer.prompt<{ queryStyle: QueryStyle }>([
    {
      type: 'list',
      name: 'queryStyle',
      message: 'What is your preferred style?',
      default: 'drizzle',
      choices: [
        { name: 'Drizzle ORM (recommended)', value: 'drizzle' },
        { name: 'Direct SQL', value: 'raw' },
      ],
    },
  ])

  return queryStyle
}

const promptForStarter = async (interactive: boolean): Promise<boolean> => {
  if (!interactive) {
    return true
  }

  log('')
  log('To see the database in action, we can create some migrations with sample data')
  log('and then query it. Alternatively, you can do this yourself at any time.')

  log('')
  const { answer } = await inquirer.prompt<{ answer: boolean }>([
    {
      type: 'confirm',
      name: 'answer',
      message: 'Do you want to create sample data?',
      default: true,
    },
  ])
  return answer
}

const installDependencies = async (
  pm: PmInfo,
  projectRoot: string,
  migrationsDirectory: string,
  queryStyle: QueryStyle,
): Promise<void> => {
  sectionHeading('Install dependencies')
  info("We'll install the dependencies you need to use Netlify Database")
  info('')
  info(`${NETLIFY_DATABASE_PACKAGE} is the main interface for Netlify Database, letting you initialize and query the`)
  info('database with no configuration.')

  if (queryStyle === 'drizzle') {
    info('')
    info('Drizzle is added too so your schema lives in TypeScript and migrations are generated from it.')
  }

  const toInstall: PackageEntry[] = []
  const confirmedNames: string[] = [NETLIFY_DATABASE_PACKAGE]
  if (!(await hasDependency(NETLIFY_DATABASE_PACKAGE, projectRoot))) {
    toInstall.push({ pkg: `${NETLIFY_DATABASE_PACKAGE}@latest` })
  }
  if (queryStyle === 'drizzle') {
    confirmedNames.push(DRIZZLE_ORM_PACKAGE, DRIZZLE_KIT_PACKAGE)
    if (!(await hasDependency(DRIZZLE_ORM_PACKAGE, projectRoot))) {
      toInstall.push({ pkg: `${DRIZZLE_ORM_PACKAGE}@beta` })
    }
    if (!(await hasDependency(DRIZZLE_KIT_PACKAGE, projectRoot))) {
      toInstall.push({ pkg: `${DRIZZLE_KIT_PACKAGE}@beta`, dev: true })
    }
  }

  await installPackages(pm, projectRoot, toInstall)
  for (const name of confirmedNames) {
    success(`${name} is installed`)
  }

  if (queryStyle === 'drizzle') {
    const out = relativeToProject(projectRoot, migrationsDirectory)
    await carefullyWriteFile(join(projectRoot, 'drizzle.config.ts'), drizzleConfigTs(out), projectRoot)
    success('drizzle.config.ts ready')
  }
}

// Scaffolds the schema + first migration for the chosen ORM and returns the
// path so it can be logged. Called only when the user opts in to the starter.
const scaffoldStarter = async (
  pm: PmInfo,
  projectRoot: string,
  migrationsDirectory: string,
  queryStyle: QueryStyle,
): Promise<void> => {
  sectionHeading('Create a starter migration')

  if (queryStyle === 'drizzle') {
    info("I'll scaffold a `planets` schema in TypeScript, run `drizzle-kit generate` against it, and add a")
    info('seed migration with the eight planets in our solar system. 🪐')

    const schemaDir = join(projectRoot, 'db')
    await mkdir(schemaDir, { recursive: true })
    await carefullyWriteFile(join(schemaDir, 'schema.ts'), DRIZZLE_SCHEMA_TS, projectRoot)
    success('db/schema.ts ready')

    log('')
    info(`Running \`drizzle-kit generate --name ${STARTER_MIGRATION_NAME}\` against your schema...`)
    const [runner, ...runnerArgs] = pm.remoteRunArgs
    await spawnAsync(runner, [...runnerArgs, 'drizzle-kit', 'generate', '--name', STARTER_MIGRATION_NAME], {
      stdio: 'inherit',
      shell: true,
      cwd: projectRoot,
    })

    // The seed's timestamp is generated AFTER drizzle-kit runs, so it
    // lexicographically sorts after whatever drizzle-kit produced. If they
    // happen to land in the same second, `create_planets` < `seed_planets`
    // alphabetically still runs the CREATE TABLE first. We use the same
    // directory layout drizzle-kit uses so both migrations look consistent
    // in the migrations/ folder.
    const seedDirName = `${generateNextPrefix([], 'timestamp')}_${SEED_MIGRATION_NAME}`
    const seedDir = join(migrationsDirectory, seedDirName)
    await mkdir(seedDir, { recursive: true })
    await writeFile(join(seedDir, 'migration.sql'), DRIZZLE_SEED_SQL, { flag: 'wx' })
    log('')
    success(`Created seed migration ${seedDirName}/migration.sql`)

    return
  }

  info("I'll create a migration that sets up a `planets` table where we'll store data about the planets in our")
  info('solar system.')
  await mkdir(migrationsDirectory, { recursive: true })
  const fileName = `${generateNextPrefix([], 'timestamp')}_${STARTER_MIGRATION_NAME}.sql`
  await writeFile(join(migrationsDirectory, fileName), STARTER_MIGRATION_SQL, { flag: 'wx' })
  success(`Created ${fileName}`)
}

interface QueryResult {
  fields: Parameters<typeof formatQueryResult>[0]
  rows: Record<string, unknown>[]
  rowCount: number | null
  command: string
}

const applyAndQuery = async (
  projectRoot: string,
  migrationsDirectory: string,
): Promise<{ applied: string[]; query: QueryResult | null }> => {
  log('')
  const spinner = startSpinner({ text: 'Applying the migration to the local database' })
  let connection: Awaited<ReturnType<typeof connectRawClient>> | undefined
  try {
    connection = await connectRawClient(projectRoot)
    const applied = await applyMigrations(new PgClientExecutor(connection.client), migrationsDirectory)
    stopSpinner({
      spinner,
      text: applied.length === 0 ? 'No new migrations to apply' : `Applied ${String(applied.length)} migration(s)`,
    })

    let query: QueryResult | null = null
    try {
      const result = await connection.client.query<Record<string, unknown>>(`SELECT * FROM ${STARTER_TABLE}`)
      query = {
        fields: result.fields,
        rows: result.rows,
        rowCount: result.rowCount,
        command: result.command,
      }
    } catch {
      // The table may not exist (e.g. Drizzle's schema failed to compile). We
      // skip rendering the query block when that happens.
    }

    return { applied, query }
  } catch (err) {
    stopSpinner({ spinner, error: true, text: `Failed to apply migrations: ${describeError(err)}` })
    throw err
  } finally {
    if (connection) await connection.cleanup()
  }
}

const renderQueryBlock = (query: QueryResult): void => {
  info("We have data! Let's run a command that lets you run one-shot queries using SQL:")
  log('')
  log(`  ${chalk.cyan(`$ ${netlifyCommand()} database connect --query "SELECT * FROM ${STARTER_TABLE}"`)}`)
  log('')

  const formatted = formatQueryResult(query.fields, query.rows, query.rowCount, query.command)
  for (const line of formatted.split('\n')) {
    log(`  ${line}`)
  }
}

const printNextSteps = (orm: QueryStyle, withStarter: boolean): void => {
  log('')
  log('A few commands to try from here:')
  log('')
  log('  • Check the state of your database, including applied and pending migrations:')
  log(`      ${chalk.cyan(`${netlifyCommand()} database status`)}`)
  log('')
  log('  • Open an interactive Postgres REPL for querying and introspecting the database:')
  log(`      ${chalk.cyan(`${netlifyCommand()} database connect`)}`)
  log('')

  if (withStarter) {
    log('  • Run a one-shot query:')
    log(`      ${chalk.cyan(`${netlifyCommand()} database connect --query "SELECT * FROM ${STARTER_TABLE}"`)}`)
  } else if (orm === 'drizzle') {
    log('  • Define your tables in `db/schema.ts`, then generate a migration from them:')
    log(`      ${chalk.cyan('npx drizzle-kit generate')}`)
  } else {
    log('  • Create your first migration:')
    log(`      ${chalk.cyan(`${netlifyCommand()} database migrations new`)}`)
  }
  log('')

  const template = orm === 'drizzle' ? 'database-drizzle' : 'database'
  log(`  • Scaffold a function that queries the \`${STARTER_TABLE}\` table:`)
  log(`      ${chalk.cyan(`${netlifyCommand()} functions:create --language typescript --template ${template}`)}`)
  log('')

  if (withStarter) {
    log('  • Wipe local data and restore the database to a blank state:')
    log(`      ${chalk.cyan(`${netlifyCommand()} database reset`)}`)
    log('')
  }

  log('  • Deploy your project (and its migrations) to Netlify:')
  log(`      ${chalk.cyan(`${netlifyCommand()} deploy`)}`)

  log('')
  log(`To explore more of Netlify Database, visit ${chalk.cyan(DOCS_URL)}.`)
}

export const initDatabase = async (options: DatabaseInitOptions, command: BaseCommand) => {
  const projectRoot = command.netlify.site.root ?? command.project.root ?? command.project.baseDirectory
  if (!projectRoot) {
    throw new Error('Could not determine the project root directory.')
  }
  const yes = options.yes ?? false
  const interactive = isInteractive() && !yes
  const pm = getPackageManager(command)

  log(chalk.bold('Netlify Database'))
  info('A fully managed Postgres database built into the Netlify platform. We automatically handle provisioning,')
  info('migrations, and branching for you, so you can focus on building your application.')

  const migrationsDirectory = resolveMigrationsDirectory(command)
  const existingMigrations = (await readDirectoryEntries(migrationsDirectory)).filter((name) => !name.startsWith('.'))
  if (existingMigrations.length > 0) {
    log('')
    info(
      `It looks like you already have migrations set up in ${chalk.bold(
        relativeToProject(projectRoot, migrationsDirectory),
      )}.`,
    )
    info(`Run ${chalk.cyan(`${netlifyCommand()} database status`)} to see their current state.`)
    return
  }

  log('')
  info('Database migrations are ordered SQL files that define and evolve your schema.')
  info(
    `Netlify manages and applies migrations for you. Read more at ${chalk.cyan(
      'https://ntl.fyi/database-migrations',
    )}.`,
  )
  info('')
  info('Do you want to write SQL queries directly in your application and author migrations yourself, or')
  info('do you want an ORM (Drizzle) to write the schema in code and generate the migrations for you?')

  const queryStyle = await promptForQueryStyle(interactive)

  await installDependencies(pm, projectRoot, migrationsDirectory, queryStyle)

  const withStarter = await promptForStarter(interactive)

  if (withStarter) {
    await scaffoldStarter(pm, projectRoot, migrationsDirectory, queryStyle)

    sectionHeading('Apply the migration')
    info(
      'Applying the migration to your local database. This step is handled automatically by Netlify when you deploy.',
    )
    const { query } = await applyAndQuery(projectRoot, migrationsDirectory)

    if (query) {
      sectionHeading('Query data')
      renderQueryBlock(query)
    } else {
      info(`Could not query the \`${STARTER_TABLE}\` table. If you expected it to exist, check your migrations.`)
    }
  }

  sectionHeading('🎉 You are all set! 🎉')
  printNextSteps(queryStyle, withStarter)
}
