import { OptionValues } from 'commander'

import BaseCommand from '../base-command.js'

export const createLogoutCommand = (program: BaseCommand) =>
  program
    .command('logout', { hidden: true })
    .description('Logout of your Netlify account')
    .option('--forget', "Also delete the current account's saved auth token from this device")
    .option('--all', 'Delete the saved auth tokens for every account on this device')
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { logout } = await import('./logout.js')
      await logout(options, command)
    })
