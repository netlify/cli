import { OptionValues } from 'commander'

import BaseCommand from '../base-command.js'

export const createAiCommand = (program: BaseCommand) => {
  // Add ai:start subcommand following CLI convention
  program
    .command('ai:start')
    .argument('<hash>', 'Project hash for AI initialization')
    .description('Start AI project initialization with hash')
    .action(async (hash: string, options: OptionValues, command: BaseCommand) => {
      // Set the hash as the first argument for the command
      command.args = [hash]
      const { aiStartCommand } = await import('./ai-start.js')
      await aiStartCommand(options, command)
    })

  return program
    .command('ai')
    .description('AI-powered development tools')
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { aiCommand: mainAiCommand } = await import('./ai.js')
      mainAiCommand(options, command)
    })
}