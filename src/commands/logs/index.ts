import BaseCommand from '../base-command.js'

import { createLogsBuildCommand } from './build.js'
import { createLogsFunctionCommand } from './functions.js'

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
