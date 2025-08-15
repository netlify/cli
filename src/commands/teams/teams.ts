import { OptionValues } from 'commander'

import BaseCommand from '../base-command.js'

export const createTeamsCommand = (program: BaseCommand) => {
  return program
    .command('teams')
    .description('List all teams you have access to')
    .option('--json', 'Output team data as JSON')
    .addExamples(['netlify teams', 'netlify teams --json'])
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { teamsList } = await import('./teams-list.js')
      await teamsList(options, command)
    })
}