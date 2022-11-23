// @ts-check
const { createGraphConfigWriteCommand } = require('./graph-config-write.cjs')
const { createGraphEditCommand } = require('./graph-edit.cjs')
const { createGraphHandlerCommand } = require('./graph-handler.cjs')
const { createGraphInitCommand } = require('./graph-init.cjs')
const { createGraphLibraryCommand } = require('./graph-library.cjs')
const { createGraphOperationsCommand } = require('./graph-operations.cjs')
const { createGraphPullCommand } = require('./graph-pull.cjs')

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
const createGraphCommand = (program) => {
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

module.exports = { createGraphCommand }
