import type BaseCommand from '../base-command.js'
import type { LogoutOptionValues } from './option_values.js'

export const createLogoutCommand = (program: BaseCommand) =>
  program
    .command('logout', { hidden: true })
    .description('Logout of your Netlify account')
    .action(async (options: LogoutOptionValues, command: BaseCommand) => {
      const { logout } = await import('./logout.js')
      await logout(options, command)
    })
