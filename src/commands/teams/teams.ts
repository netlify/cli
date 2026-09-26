import type BaseCommand from '../base-command.js'
import type { TeamsListOptionValues, TeamsOptionValues } from './option_values.js'

const teams = (_options: TeamsOptionValues, command: BaseCommand) => {
  command.help()
}

export const createTeamsCommand = (program: BaseCommand) => {
  program
    .command('teams:list')
    .description('List all teams you have access to')
    .option('--json', 'Output team data as JSON')
    .addExamples(['netlify teams:list', 'netlify teams:list --json'])
    .action(async (options: TeamsListOptionValues, command: BaseCommand) => {
      const { teamsList } = await import('./teams-list.js')
      await teamsList(options, command)
    })

  return program
    .command('teams')
    .description(`Handle various team operations\nThe teams command will help you manage your teams`)
    .addExamples(['netlify teams:list'])
    .action(teams)
}
