// @ts-check
const { createGraphEditCommand } = require('./graph-edit')
const { createGraphHandlerCommand } = require('./graph-handler')
const { createGraphLibraryCommand } = require('./graph-library')
const { createGraphOperationCommand } = require('./graph-operations')
const { createGraphPullCommand } = require('./graph-pull')

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
const createGraphCommand = (program) => {
  createGraphEditCommand(program)
  createGraphHandlerCommand(program)
  createGraphLibraryCommand(program)
  createGraphOperationCommand(program)
  createGraphPullCommand(program)

  return program
    .command('graph')
    .description('(Beta) Control the Netlify Graph functions for the current site')
    .addExamples(['netlify graph:pull', 'netlify graph:edit'])
    .action(graph)
}

module.exports = { createGraphCommand }
