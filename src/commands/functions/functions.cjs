// @ts-check
const { chalk } = require('../../utils/index.cjs')

const { createFunctionsBuildCommand } = require('./functions-build.cjs')
const { createFunctionsCreateCommand } = require('./functions-create.cjs')
const { createFunctionsInvokeCommand } = require('./functions-invoke.cjs')
const { createFunctionsListCommand } = require('./functions-list.cjs')
const { createFunctionsServeCommand } = require('./functions-serve.cjs')

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
