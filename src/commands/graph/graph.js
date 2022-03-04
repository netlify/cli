// @ts-check
const { createGraphConfigWriteCommand } = require('./graph-config-write')
const { createGraphEditCommand } = require('./graph-edit')
const { createGraphHandlerCommand } = require('./graph-handler')
const { createGraphInitCommand } = require('./graph-init')
const { createGraphLibraryCommand } = require('./graph-library')
const { createGraphOperationsCommand } = require('./graph-operations')
const { createGraphOperationsImportCommand } = require('./graph-operations-import')
const { createGraphOperationsSearchCommand } = require('./graph-operations-search')
const { createGraphOperationsShareCommand } = require('./graph-operations-share')
const { createGraphPullCommand } = require('./graph-pull')
const { createGraphSessionResetCommand } = require('./graph-session-reset')

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
  createGraphConfigWriteCommand(program)
  createGraphEditCommand(program)
  createGraphHandlerCommand(program)
  createGraphInitCommand(program)
  createGraphLibraryCommand(program)
  createGraphOperationsCommand(program)
  createGraphOperationsImportCommand(program)
  createGraphOperationsShareCommand(program)
  createGraphPullCommand(program)
  createGraphSessionResetCommand(program)
  createGraphOperationsSearchCommand(program)

  return program
    .command('graph')
    .description('(Beta) Control the Netlify Graph functions for the current site')
    .addExamples(['netlify graph:pull', 'netlify graph:edit'])
    .action(graph)
}

module.exports = { createGraphCommand }
