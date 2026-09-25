import type BaseCommand from '../base-command.js'
import type { SwitchOptionValues } from './switch.js'

export const createSwitchCommand = (program: BaseCommand) =>
  program
    .command('switch')
    .description('Switch your active Netlify account')
    .option('--email <email>', 'Switch to the account matching this email address')
    .action(async (options: SwitchOptionValues, command: BaseCommand) => {
      const { switchCommand } = await import('./switch.js')
      await switchCommand(options, command)
    })
