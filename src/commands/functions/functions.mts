
import { OptionValues } from 'commander'

import { chalk } from '../../utils/command-helpers.mjs'
import BaseCommand from '../base-command.mjs'

import { createFunctionsCreateCommand } from './functions-create.mjs'
import { createFunctionsInvokeCommand } from './functions-invoke.mjs'
import { createFunctionsListCommand } from './functions-list.mjs'
import { createFunctionsServeCommand } from './functions-serve.mjs'

const functions = (options: OptionValues, command: BaseCommand) => {
  command.help()
}

export const createFunctionsCommand = (program: BaseCommand) => {
  program
    .command('functions:build')
    .alias('function:build')
    .description('Build functions locally')
    .option('-f, --functions <directory>', 'Specify a functions directory to build to')
    .option('-s, --src <directory>', 'Specify the source directory for the functions')
    .action(async(options: OptionValues, command: BaseCommand) => {
      const { functionsBuild } = await import('./functions-build.mjs')
      await functionsBuild(options, command)
    })

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
