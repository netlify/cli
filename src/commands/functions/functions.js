// @ts-check
const { chalk } = require('../../utils')

const { createFunctionsBuildCommand } = require('./functions-build')
const { createFunctionsCreateCommand } = require('./functions-create')
const { createFunctionsInvokeCommand } = require('./functions-invoke')
const { createFunctionsListCommand } = require('./functions-list')
const { createFunctionsServeCommand } = require('./functions-serve')

/**
 * The functions command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const functions = (options, command) => {
  command.help()
}

/**
 * Creates the `netlify functions` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createFunctionsCommand = (program) => {
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
