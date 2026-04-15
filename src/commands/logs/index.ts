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
        '-t, --timeline <duration>',
        'Fetch historical logs for the given duration (e.g. 30m, 1h, 2h, 1d, 1h30m) instead of streaming in real time',
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
      'netlify logs:function my-function --timeline 1h',
      'netlify logs:function --url https://my-branch--my-site.netlify.app --timeline 30m',
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
