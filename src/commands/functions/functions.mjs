// @ts-check
import { chalk } from '../../utils/command-helpers.mjs'

import { createFunctionsBuildCommand } from './functions-build.mjs'
import { createFunctionsCreateCommand } from './functions-create.mjs'
import { createFunctionsInvokeCommand } from './functions-invoke.mjs'
import { createFunctionsListCommand } from './functions-list.mjs'
import { createFunctionsServeCommand } from './functions-serve.mjs'

/**
 * The functions command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
const functions = (options, command) => {
  command.help()
}

/**
 * Creates the `netlify functions` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createFunctionsCommand = (program) => {
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
