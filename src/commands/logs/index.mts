import { OptionValues } from 'commander'

import BaseCommand from '../base-command.mjs'

import { createLogsFunctionCommand } from './functions.mjs'

export const createLogsCommand = (program: BaseCommand) => {
  program
  .command('logs:deploy')
  .alias('logs:build')
  .description('(Beta) Stream the logs of deploys currently being built to the console')
  .action(async (options: OptionValues, command: BaseCommand) => {
    const { logsBuild } = await import('./build.mjs')
    await logsBuild(options, command)
  })

  createLogsFunctionCommand(program)

  return program
    .command('logs')
    .alias('log')
    .description('Stream logs from your site')
    .addExamples(['netlify logs:deploy', 'netlify logs:function', 'netlify logs:function my-function'])
    .action((_, command: BaseCommand) => command.help())
}
