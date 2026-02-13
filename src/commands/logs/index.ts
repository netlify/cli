import { Option, OptionValues, Argument } from 'commander'

import BaseCommand from '../base-command.js'

import { CLI_LOG_LEVEL_CHOICES_STRING } from './log-levels.js'

export const createLogsBuildCommand = (program: BaseCommand) => {
  program
    .command('logs:deploy')
    .alias('logs:build')
    .description('Stream the logs of deploys currently being built to the console')
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { logsBuild } = await import('./build.js')
      await logsBuild(options, command)
    })
}

export const createLogsFunctionCommand = (program: BaseCommand) => {
  program
    .command('logs:function')
    .alias('logs:functions')
    .addOption(
      new Option('-l, --level <levels...>', `Log levels to stream. Choices are:${CLI_LOG_LEVEL_CHOICES_STRING}`),
    )
    .addOption(new Option('--deploy-id <deployId>', 'Deploy ID to look up the function from'))
    .addOption(new Option('--from <datetime>', 'Start date for historical logs (ISO 8601 format)'))
    .addOption(new Option('--to <datetime>', 'End date for historical logs (ISO 8601 format, defaults to now)'))
    .addArgument(new Argument('[functionName]', 'Name or ID of the function to stream logs for'))
    .addExamples([
      'netlify logs:function',
      'netlify logs:function my-function',
      'netlify logs:function my-function --deploy-id <deploy-id>',
      'netlify logs:function my-function -l info warn',
      'netlify logs:function my-function --from 2026-01-01T00:00:00Z',
      'netlify logs:function my-function --from 2026-01-01T00:00:00Z --to 2026-01-02T00:00:00Z',
    ])
    .description('Stream netlify function logs to the console')
    .action(async (functionName: string | undefined, options: OptionValues, command: BaseCommand) => {
      const { logsFunction } = await import('./functions.js')
      await logsFunction(functionName, options, command)
    })
}

export const createLogsEdgeFunctionCommand = (program: BaseCommand) => {
  program
    .command('logs:edge-functions')
    .addOption(
      new Option('-l, --level <levels...>', `Log levels to stream. Choices are:${CLI_LOG_LEVEL_CHOICES_STRING}`),
    )
    .addOption(new Option('--deploy-id <deployId>', 'Deploy ID to stream edge function logs for'))
    .addOption(new Option('--from <datetime>', 'Start date for historical logs (ISO 8601 format)'))
    .addOption(new Option('--to <datetime>', 'End date for historical logs (ISO 8601 format, defaults to now)'))
    .addExamples([
      'netlify logs:edge-functions',
      'netlify logs:edge-functions --deploy-id <deploy-id>',
      'netlify logs:edge-functions --from 2026-01-01T00:00:00Z',
      'netlify logs:edge-functions --from 2026-01-01T00:00:00Z --to 2026-01-02T00:00:00Z',
      'netlify logs:edge-functions -l info warn',
    ])
    .description('Stream netlify edge function logs to the console')
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { logsEdgeFunction } = await import('./edge-functions.js')
      await logsEdgeFunction(options, command)
    })
}

export const createLogsCommand = (program: BaseCommand) => {
  createLogsBuildCommand(program)

  createLogsFunctionCommand(program)

  createLogsEdgeFunctionCommand(program)

  return program
    .command('logs')
    .alias('log')
    .description('Stream logs from your project')
    .addExamples([
      'netlify logs:deploy',
      'netlify logs:function',
      'netlify logs:function my-function',
      'netlify logs:edge-functions',
      'netlify logs:edge-functions --deploy-id <deploy-id>',
    ])
    .action((_, command: BaseCommand) => command.help())
}
