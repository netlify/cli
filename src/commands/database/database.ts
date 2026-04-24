import { Option } from 'commander'
import inquirer from 'inquirer'
import BaseCommand from '../base-command.js'
import type { DatabaseBoilerplateType, DatabaseInitOptions } from './legacy/db-init.js'
import type { MigrationNewOptions } from './db-migration-new.js'
import type { MigrationPullOptions } from './db-migration-pull.js'
import type { MigrationsResetOptions } from './db-migrations-reset.js'
import type { DatabaseStatusOptions } from './db-status.js'

const supportedBoilerplates = new Set<DatabaseBoilerplateType>(['drizzle'])

export const createDatabaseCommand = (program: BaseCommand) => {
  if (process.env.EXPERIMENTAL_NETLIFY_DB_ENABLED !== '1') {
    const dbCommand = program
      .command('db')
      .alias('database')
      .description(`Provision a production ready Postgres database with a single command`)
      .addExamples(['netlify db status', 'netlify db init', 'netlify db init --help'])

    dbCommand
      .command('init')
      .description(`Initialize a new database for the current site`)
      .option(
        '--assume-no',
        'Non-interactive setup. Does not initialize any third-party tools/boilerplate. Ideal for CI environments or AI tools.',
        false,
      )
      .addOption(
        new Option('--boilerplate <tool>', 'Type of boilerplate to add to your project.').choices(
          Array.from(supportedBoilerplates).sort(),
        ),
      )
      .option('--no-boilerplate', "Don't add any boilerplate to your project.")
      .option('-o, --overwrite', 'Overwrites existing files that would be created when setting up boilerplate')
      .action(async (_options: Record<string, unknown>, command: BaseCommand) => {
        const { init } = await import('./legacy/db-init.js')

        // Only prompt for drizzle if the user did not specify a boilerplate option, and if we're in
        // interactive mode
        if (_options.boilerplate === undefined && !_options.assumeNo) {
          const answers = await inquirer.prompt<{ useDrizzle: boolean }>([
            {
              type: 'confirm',
              name: 'useDrizzle',
              message: 'Set up Drizzle boilerplate?',
            },
          ])
          if (answers.useDrizzle) {
            command.setOptionValue('boilerplate', 'drizzle')
          }
        }

        const options = _options as DatabaseInitOptions
        if (options.assumeNo) {
          options.boilerplate = false
          options.overwrite = false
        }

        await init(options, command)
      })
      .addExamples([`netlify db init --assume-no`, `netlify db init --boilerplate=drizzle --overwrite`])

    dbCommand
      .command('status')
      .description(`Check the status of the database`)
      .action(async (options, command) => {
        const { status } = await import('./legacy/db-status.js')
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        await status(options, command)
      })
  }

  if (process.env.EXPERIMENTAL_NETLIFY_DB_ENABLED === '1') {
    const dbCommand = program
      .command('database')
      .alias('db')
      .description(`Provision a production ready Postgres database with a single command`)
      .addExamples([
        'netlify database status',
        'netlify database migrations apply',
        'netlify database migrations pull',
        'netlify database migrations new',
        'netlify database reset',
      ])

    dbCommand
      .command('status')
      .description('Check the status of the database, including applied and pending migrations')
      .option('-b, --branch <branch>', 'Netlify branch name to query; defaults to the local development database')
      .option(
        '--show-credentials',
        'Include the full connection string (including username and password) in the output',
        false,
      )
      .option('--json', 'Output result as JSON')
      .action(async (options: DatabaseStatusOptions, command: BaseCommand) => {
        const { statusDb } = await import('./db-status.js')
        await statusDb(options, command)
      })
      .addExamples([
        'netlify database status',
        'netlify database status --show-credentials',
        'netlify database status --json',
        'netlify database status --branch my-feature-branch',
      ])

    dbCommand
      .command('init')
      .description('Interactive setup: install the package, scaffold a starter migration, and verify the database')
      .option('-y, --yes', 'Non-interactive mode. Accepts the defaults for every prompt.', false)
      .action(async (options: { yes?: boolean }, command: BaseCommand) => {
        const { initDatabase } = await import('./db-init.js')
        await initDatabase(options, command)
      })
      .addExamples(['netlify database init', 'netlify database init --yes'])

    dbCommand
      .command('connect')
      .description('Connect to the database')
      .option('-q, --query <sql>', 'Execute a single query and exit')
      .option(
        '--json',
        'Output query results as JSON. When used without --query, prints the connection details as JSON instead.',
      )
      .action(async (options: { query?: string; json?: boolean }, command: BaseCommand) => {
        const { connect } = await import('./db-connect.js')
        await connect(options, command)
      })
      .addExamples([
        'netlify database connect',
        'netlify database connect --query "SELECT * FROM users"',
        'netlify database connect --json --query "SELECT * FROM users"',
        'netlify database connect --json',
      ])

    dbCommand
      .command('reset')
      .description('Reset the local development database, removing all data and tables')
      .option('--json', 'Output result as JSON')
      .action(async (options: { json?: boolean }, command: BaseCommand) => {
        const { reset } = await import('./db-reset.js')
        await reset(options, command)
      })

    const migrationsCommand = dbCommand.command('migrations').description('Manage database migrations')

    migrationsCommand
      .command('apply')
      .description('Apply database migrations to the local development database')
      .option('--to <name>', 'Target migration name or prefix to apply up to (applies all if omitted)')
      .option('--json', 'Output result as JSON')
      .action(async (options: { to?: string; json?: boolean }, command: BaseCommand) => {
        const { migrate } = await import('./db-migrate.js')
        await migrate(options, command)
      })

    migrationsCommand
      .command('new')
      .description('Create a new migration')
      .option('-d, --description <description>', 'Purpose of the migration (used to generate the file name)')
      .addOption(
        new Option('-s, --scheme <scheme>', 'Numbering scheme for migration prefixes').choices([
          'sequential',
          'timestamp',
        ]),
      )
      .option('--json', 'Output result as JSON')
      .action(async (options: MigrationNewOptions, command: BaseCommand) => {
        const { migrationNew } = await import('./db-migration-new.js')
        await migrationNew(options, command)
      })
      .addExamples([
        'netlify database migrations new',
        'netlify database migrations new --description "add users table" --scheme sequential',
      ])

    migrationsCommand
      .command('pull')
      .description('Pull migrations and overwrite local migration files')
      .option(
        '-b, --branch [branch]',
        "Pull migrations for a specific branch (defaults to 'production'; pass --branch with no value to use local git branch)",
      )
      .option('--force', 'Skip confirmation prompt', false)
      .option('--json', 'Output result as JSON')
      .action(async (options: MigrationPullOptions, command: BaseCommand) => {
        const { migrationPull } = await import('./db-migration-pull.js')
        await migrationPull(options, command)
      })
      .addExamples([
        'netlify database migrations pull',
        'netlify database migrations pull --branch staging',
        'netlify database migrations pull --branch',
        'netlify database migrations pull --force',
      ])

    migrationsCommand
      .command('reset')
      .description('Delete local migration files that have not been applied yet')
      .option('-b, --branch <branch>', 'Target a remote preview branch instead of the local development database')
      .option('--json', 'Output result as JSON')
      .action(async (options: MigrationsResetOptions, command: BaseCommand) => {
        const { migrationsReset } = await import('./db-migrations-reset.js')
        await migrationsReset(options, command)
      })
      .addExamples([
        'netlify database migrations reset',
        'netlify database migrations reset --branch my-feature-branch',
      ])
  }
}
