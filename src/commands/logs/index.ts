import { OptionValues, Argument } from 'commander'

import BaseCommand from '../base-command.js'

export const createLogsBuildCommand = (program: BaseCommand) => {
  program
    .command('logs:deploy')
    .alias('logs:build')
    .description('(Beta) Stream the logs of deploys currently being built to the console')
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { logsBuild } = await import('./build.js')
      await logsBuild(options, command)
    })
}

export const createLogsFunctionCommand = (program: BaseCommand) => {
  program
    .command('logs:function')
    .alias('logs:functions')
    .addArgument(new Argument('[functionName]', 'Name of the function to stream logs for'))
    .addExamples(['netlify logs:function my-function', 'netlify logs:function'])
    .description('(Beta) Stream netlify function logs to the console')
    .action(async (functionName: string | undefined, options: OptionValues, command: BaseCommand) => {
      const { logsFunction } = await import('./functions.js')
      await logsFunction(functionName, options, command)
    })
}

export const createLogsCommand = (program: BaseCommand) => {
  createLogsBuildCommand(program)

  createLogsFunctionCommand(program)

  return program
    .command('logs')
    .alias('log')
    .description('Stream logs from your site')
    .addExamples(['netlify logs:deploy', 'netlify logs:function', 'netlify logs:function my-function'])
    .action((_, command: BaseCommand) => command.help())
}
