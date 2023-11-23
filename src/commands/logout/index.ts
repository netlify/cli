import { OptionValues } from 'commander'

import BaseCommand from '../base-command.js'

export const createLogoutCommand = (program: BaseCommand) =>
  program
    .command('logout', { hidden: true })
    .description('Logout of your Netlify account')
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { logout } = await import('./logout.js')
      await logout(options, command)
    })
