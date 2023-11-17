import { OptionValues } from 'commander'

import BaseCommand from '../base-command.mjs'

export const createLogoutCommand = (program: BaseCommand) =>
  program
    .command('logout', { hidden: true })
    .description('Logout of your Netlify account')
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { logout } = await import('./logout.mjs')
      await logout(options, command)
    })
