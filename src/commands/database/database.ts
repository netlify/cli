import BaseCommand from '../base-command.js'
import { dev } from './dev-branch.js'
import { status } from './status.js'
import { init } from './init.js'

export type Extension = {
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

export const createDatabaseCommand = (program: BaseCommand) => {
  const dbCommand = program.command('db').alias('database').description(`TODO: write description for database command`)

  dbCommand
    .command('init')
    .description('Initialize a new database')

    .option('--no-drizzle', 'Skips drizzle')
    .option('-y, --yes', 'Skip prompts and use default values')
    .option('-o, --overwrite', 'Overwrites existing files that would be created when setting up drizzle')
    .action(init)

  dbCommand
    .command('dev')
    .description('Set up a local development database branch')
    .option('--reset', 'Resets the development branch to the current state of main')
    .option('--init', 'Sets up a local development branch for the current user')
    .action(dev)
  dbCommand.command('status').description('Check the status of the database').action(status)

  return dbCommand
}
