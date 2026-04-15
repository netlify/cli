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
    .addOption(
      new Option(
        '--since <time>',
        'Start of the historical log window. Accepts a duration (e.g. 10m, 1h, 24h, 2d) or an ISO 8601 timestamp',
      ),
    )
    .addOption(
      new Option(
        '--until <time>',
        'End of the historical log window. Accepts a duration or an ISO 8601 timestamp (defaults to now)',
      ),
    )
    .addOption(
      new Option(
        '-u, --url <url>',
        'Show logs for the deploy behind the given URL. Supports deploy permalinks and branch subdomains',
      ),
    )
    .addArgument(new Argument('[functionNames...]', 'Names of the functions to stream logs for'))
    .addExamples([
      'netlify logs:function',
      'netlify logs:function my-function',
      'netlify logs:function my-function other-function',
      'netlify logs:function my-function -l info warn',
      'netlify logs:function my-function --since 1h',
      'netlify logs:function my-function --since 24h',
      'netlify logs:function my-function --since 2026-04-14T00:00:00Z --until 2026-04-15T00:00:00Z',
      'netlify logs:function --url https://my-branch--my-site.netlify.app --since 30m',
    ])
    .description('Stream netlify function logs to the console')
    .action(async (functionNames: string[], options: OptionValues, command: BaseCommand) => {
      const { logsFunction } = await import('./functions.js')
      await logsFunction(functionNames, options, command)
    })
}

export const createLogsCommand = (program: BaseCommand) => {
  createLogsBuildCommand(program)

  createLogsFunctionCommand(program)

  return program
    .command('logs')
    .alias('log')
    .description('Stream logs from your project')
    .addExamples(['netlify logs:deploy', 'netlify logs:function', 'netlify logs:function my-function'])
    .action((_, command: BaseCommand) => command.help())
}
