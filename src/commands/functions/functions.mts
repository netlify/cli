// @ts-check

const { chalk } = require('../../utils/index.mjs')


const { createFunctionsBuildCommand } = require('./functions-build.mjs')

const { createFunctionsCreateCommand } = require('./functions-create.mjs')

const { createFunctionsInvokeCommand } = require('./functions-invoke.mjs')

const { createFunctionsListCommand } = require('./functions-list.mjs')

const { createFunctionsServeCommand } = require('./functions-serve.mjs')

/**
 * The functions command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */

const functions = (options: $TSFixMe, command: $TSFixMe) => {
  command.help()
}

/**
 * Creates the `netlify functions` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */

export const createFunctionsCommand = (program: $TSFixMe) => {
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

export default { createFunctionsCommand }
