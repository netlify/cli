import { mkdir, readdir, writeFile } from 'fs/promises'
import { join } from 'path'

import { applyMigrations } from '@netlify/dev'
import inquirer from 'inquirer'

import { chalk, log, netlifyCommand } from '../../utils/command-helpers.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import { isInteractive } from '../../utils/scripted-commands.js'
import BaseCommand from '../base-command.js'
import { generateNextPrefix } from './db-migration-new.js'
import { carefullyWriteFile, spawnAsync } from './legacy/utils.js'
import { connectRawClient } from './util/db-connection.js'
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

const readDirectoryEntries = async (dir: string): Promise<string[]> => {
  try {
    return await readdir(dir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

const promptForQueryStyle = async (interactive: boolean): Promise<QueryStyle> => {
  // Non-interactive (no TTY or --yes): skip the prompt and go straight to
  // Drizzle. A TypeScript schema is friendlier for both agents and scripts
  // than hand-authored SQL, and it matches the "I don't know" fallback in
  // the interactive path.
  if (!interactive) return 'drizzle'

  log('')
  let { queryStyle } = await inquirer.prompt<{ queryStyle: QueryStyle | undefined }>([
    {
      type: 'list',
      name: 'queryStyle',
      message: 'What is your preferred style?',
      default: 'raw',
      choices: [
        { name: 'Direct SQL', value: 'raw' },
        { name: 'Drizzle ORM', value: 'drizzle' },
        { name: "I don't know", value: undefined },
      ],
    },
  ])

  if (!queryStyle) {
    log('')
    log("Let's go with Drizzle ORM so that you don't have to write migrations manually.")

    queryStyle = 'drizzle'
  }

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

// Installs @netlify/database plus (if Drizzle) drizzle-orm + drizzle-kit,
// and scaffolds drizzle.config.ts. The starter migration + schema get
// scaffolded separately, only when the user opts in.
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
    // alphabetically still runs the CREATE TABLE first.
    const seedName = `${generateNextPrefix([], 'timestamp')}_${SEED_MIGRATION_NAME}.sql`
    await writeFile(join(migrationsDirectory, seedName), DRIZZLE_SEED_SQL, { flag: 'wx' })
    log('')
    success(`Created seed migration ${seedName}`)
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

// Unwraps AggregateError's inner errors into a single readable string. pg's
// connection errors show up this way when the server resolves to multiple
// addresses (IPv4/IPv6) and every attempt fails — the outer message is empty
// without this.
const describeError = (err: unknown): string => {
  if (err && typeof err === 'object' && 'errors' in err && Array.isArray((err as AggregateError).errors)) {
    const inner = (err as AggregateError).errors
      .map((e) => (e instanceof Error ? e.message : String(e)))
      .filter((msg) => msg.length > 0)
    if (inner.length > 0) return inner.join('; ')
  }
  if (err instanceof Error) return err.message || err.name || 'unknown error'
  return String(err)
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
  // A TTY with no --yes override is the only case where we prompt. Agents
  // and `--yes` both get the same non-interactive flow: skip the ORM prompt
  // and default to Drizzle.
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
