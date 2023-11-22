import { chalk } from '../../utils/command-helpers.js'

import { createFunctionsBuildCommand } from './functions-build.js'
import { createFunctionsCreateCommand } from './functions-create.js'
import { createFunctionsInvokeCommand } from './functions-invoke.js'
import { createFunctionsListCommand } from './functions-list.js'
import { createFunctionsServeCommand } from './functions-serve.js'

/**
 * The functions command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.js').default} command
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'options' implicitly has an 'any' type.
const functions = (options, command) => {
  command.help()
}

/**
 * Creates the `netlify functions` command
 * @param {import('../base-command.js').default} program
 * @returns
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'program' implicitly has an 'any' type.
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
      'netlify functions:build --functions build/to/directory --src source/directory',
    ])
    .action(functions)
}
