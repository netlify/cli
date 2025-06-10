import { OptionValues } from 'commander'

import BaseCommand from '../base-command.js'

export const createAiCommand = (program: BaseCommand) => {
  program
    .command('ai')
    .description('AI-powered development tools')
    .option('--json', 'Output information as JSON')
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { aiCommand } = await import('./ai.js')
      aiCommand(options, command)
    })
}