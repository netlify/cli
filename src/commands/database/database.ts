import BaseCommand from '../base-command.js'
import { status } from './status.js'
import { init } from './init.js'

export type SiteInfo = {
  id: string
  name: string
  account_id: string
  admin_url: string
  url: string
  ssl_url: string
}

export const createDatabaseCommand = (program: BaseCommand) => {
  const dbCommand = program
    .command('db')
    .alias('database')
    .description(`Provision a production ready Postgres database with a single command`)
    .addExamples(['netlify db status', 'netlify db init', 'netlify db init --help'])

  dbCommand
    .command('init')
    .description(`Initialize a new database for the current site`)
    .option(`--drizzle`, 'Initialize basic drizzle config and schema boilerplate')
    .option('--no-drizzle', 'Does not initialize drizzle and skips any related prompts')
    .option(
      '--minimal',
      'Minimal non-interactive setup. Does not initialize drizzle or any boilerplate. Ideal for CI or AI tools.',
    )
    .option('-o, --overwrite', 'Overwrites existing files that would be created when setting up drizzle')
    .action(init)
    .addExamples([`netlify db init --minimal`, `netlify db init --drizzle --overwrite`])

  dbCommand.command('status').description(`Check the status of the database`).action(status)
}
