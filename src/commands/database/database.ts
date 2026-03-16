import { Option } from 'commander'
import inquirer from 'inquirer'
import BaseCommand from '../base-command.js'
import type { DatabaseBoilerplateType, DatabaseInitOptions } from './init.js'
import type { MigrationNewOptions } from './migration-new.js'

export type Extension = {
  id: string
  name: string
  slug: string
  hostSiteUrl: string
  installedOnTeam: boolean
}

export type SiteInfo = {
  id: string
  name: string
  account_id: string
  admin_url: string
  url: string
  ssl_url: string
}

const supportedBoilerplates = new Set<DatabaseBoilerplateType>(['drizzle'])

export const createDatabaseCommand = (program: BaseCommand) => {
  const dbCommand = program
    .command('db')
    .alias('database')
    .description(`Provision a production ready Postgres database with a single command`)
    .addExamples([
      'netlify db status',
      'netlify db init',
      'netlify db init --help',
      ...(process.env.EXPERIMENTAL_NETLIFY_DB_ENABLED === '1'
        ? ['netlify db connection-string', 'netlify db migrate', 'netlify db reset', 'netlify db migration new']
        : []),
    ])

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
      const { init } = await import('./init.js')

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
      const { status } = await import('./status.js')
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await status(options, command)
    })

  if (process.env.EXPERIMENTAL_NETLIFY_DB_ENABLED === '1') {
    dbCommand
      .command('connection-string')
      .description('Print the connection string for the local development database')
      .option('--json', 'Output result as JSON')
      .action(async (options: { json?: boolean }, command: BaseCommand) => {
        const { connectionString } = await import('./connection-string.js')
        connectionString(options, command)
      })

    dbCommand
      .command('migrate')
      .description('Apply database migrations to the local development database')
      .option('--to <name>', 'Target migration name or prefix to apply up to (applies all if omitted)')
      .option('--json', 'Output result as JSON')
      .action(async (options: { to?: string; json?: boolean }, command: BaseCommand) => {
        const { migrate } = await import('./migrate.js')
        await migrate(options, command)
      })

    dbCommand
      .command('reset')
      .description('Reset the local development database, removing all data and tables')
      .option('--json', 'Output result as JSON')
      .action(async (options: { json?: boolean }, command: BaseCommand) => {
        const { reset } = await import('./reset.js')
        await reset(options, command)
      })

    const migrationCommand = dbCommand.command('migration').description('Manage database migrations')

    migrationCommand
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
        const { migrationNew } = await import('./migration-new.js')
        await migrationNew(options, command)
      })
      .addExamples([
        'netlify db migration new',
        'netlify db migration new --description "add users table" --scheme sequential',
      ])
  }
}
