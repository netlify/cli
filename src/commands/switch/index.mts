import { OptionValues } from 'commander'

import BaseCommand from '../base-command.mjs'

export const createSwitchCommand = (program: BaseCommand) =>
  program
    .command('switch')
    .description('Switch your active Netlify account')
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { switchCommand } = await import('./switch.mjs')
      await switchCommand(options, command)
    })
