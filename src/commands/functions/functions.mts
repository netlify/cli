// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'chalk'.
const { chalk } = require('../../utils/index.mjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createFunc... Remove this comment to see the full error message
const { createFunctionsBuildCommand } = require('./functions-build.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createFunc... Remove this comment to see the full error message
const { createFunctionsCreateCommand } = require('./functions-create.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createFunc... Remove this comment to see the full error message
const { createFunctionsInvokeCommand } = require('./functions-invoke.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createFunc... Remove this comment to see the full error message
const { createFunctionsListCommand } = require('./functions-list.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createFunc... Remove this comment to see the full error message
const { createFunctionsServeCommand } = require('./functions-serve.cjs')

/**
 * The functions command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'functions'... Remove this comment to see the full error message
const functions = (options: $TSFixMe, command: $TSFixMe) => {
  command.help()
}

/**
 * Creates the `netlify functions` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createFunc... Remove this comment to see the full error message
const createFunctionsCommand = (program: $TSFixMe) => {
  createFunctionsBuildCommand(program)
  createFunctionsCreateCommand(program)
  createFunctionsInvokeCommand(program)
  createFunctionsListCommand(program)
  createFunctionsServeCommand(program)

  const name = chalk.greenBright('`functions`')

  return program
    .command('functions')
    .alias('function')
    .description(
      `Manage netlify functions
The ${name} command will help you manage the functions in this site`,
    )
    .addExamples([
      'netlify functions:create --name function-xyz',
      'netlify functions:build --name function-abc --timeout 30s',
    ])
    .action(functions)
}

module.exports = { createFunctionsCommand }
