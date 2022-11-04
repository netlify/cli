// @ts-check

const { createGraphConfigWriteCommand } = require('./graph-config-write.mjs')

const { createGraphEditCommand } = require('./graph-edit.mjs')

const { createGraphHandlerCommand } = require('./graph-handler.mjs')

const { createGraphInitCommand } = require('./graph-init.mjs')

const { createGraphLibraryCommand } = require('./graph-library.mjs')

const { createGraphOperationsCommand } = require('./graph-operations.mjs')

const { createGraphPullCommand } = require('./graph-pull.mjs')

/**
 * The graph command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */

const graph = (options: $TSFixMe, command: $TSFixMe) => {
  command.help()
}

/**
 * Creates the `netlify graph` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */

export const createGraphCommand = (program: $TSFixMe) => {
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

export default { createGraphCommand }
