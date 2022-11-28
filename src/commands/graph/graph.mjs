// @ts-check
import { createGraphConfigWriteCommand } from './graph-config-write.mjs'
import { createGraphEditCommand } from './graph-edit.mjs'
import { createGraphHandlerCommand } from './graph-handler.mjs'
import { createGraphInitCommand } from './graph-init.mjs'
import { createGraphLibraryCommand } from './graph-library.mjs'
import { createGraphOperationsCommand } from './graph-operations.mjs'
import { createGraphPullCommand } from './graph-pull.mjs'

/**
 * The graph command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
const graph = (options, command) => {
  command.help()
}

/**
 * Creates the `netlify graph` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createGraphCommand = (program) => {
  createGraphConfigWriteCommand(program)
  createGraphEditCommand(program)
  createGraphHandlerCommand(program)
  createGraphInitCommand(program)
  createGraphLibraryCommand(program)
  createGraphOperationsCommand(program)
  createGraphPullCommand(program)

  return program
    .command('graph')
    .description('(Beta) Control the Netlify Graph functions for the current site')
    .addExamples(['netlify graph:pull', 'netlify graph:edit'])
    .action(graph)
}
