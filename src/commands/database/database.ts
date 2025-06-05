import { Option } from 'commander'
import inquirer from 'inquirer'
import BaseCommand from '../base-command.js'
import type { DatabaseBoilerplateType, DatabaseInitOptions } from './init.js'

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
}
