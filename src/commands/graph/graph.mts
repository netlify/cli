// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createGrap... Remove this comment to see the full error message
const { createGraphConfigWriteCommand } = require('./graph-config-write.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createGrap... Remove this comment to see the full error message
const { createGraphEditCommand } = require('./graph-edit.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createGrap... Remove this comment to see the full error message
const { createGraphHandlerCommand } = require('./graph-handler.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createGrap... Remove this comment to see the full error message
const { createGraphInitCommand } = require('./graph-init.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createGrap... Remove this comment to see the full error message
const { createGraphLibraryCommand } = require('./graph-library.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createGrap... Remove this comment to see the full error message
const { createGraphOperationsCommand } = require('./graph-operations.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createGrap... Remove this comment to see the full error message
const { createGraphPullCommand } = require('./graph-pull.cjs')

/**
 * The graph command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const graph = (options: $TSFixMe, command: $TSFixMe) => {
  command.help()
}

/**
 * Creates the `netlify graph` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createGrap... Remove this comment to see the full error message
const createGraphCommand = (program: $TSFixMe) => {
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
