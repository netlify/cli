// @ts-check
import { createGraphEditCommand } from './graph-edit.js'
import { createGraphPullCommand } from './graph-pull.js'

/**
 * The graph command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const graph = (options, command) => {
  command.help()
}

/**
 * Creates the `netlify graph` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
export const createGraphCommand = (program) => {
  createGraphEditCommand(program)
  createGraphPullCommand(program)

  return program
    .command('graph')
    .description('(Beta) Control the Netlify Graph functions for the current site')
    .addExamples(['netlify graph:pull', 'netlify graph:edit'])
    .action(graph)
}
