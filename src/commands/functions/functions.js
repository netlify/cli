// @ts-check

const { chalk, generateCommandsHelp, generateDescriptionHelp, generateExamplesHelp } = require('../../utils')

const { createFunctionsBuildCommand } = require('./build')
const { createFunctionsCreateCommand } = require('./create')
const { createFunctionsInvokeCommand } = require('./invoke')
const { createFunctionsListCommand } = require('./list')
const { createFunctionsServeCommand } = require('./serve')

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
    .description('Manage netlify functions')
    .addHelpText(
      'after',
      generateDescriptionHelp(`The ${name} command will help you manage the functions in this site`),
    )
    .addHelpText(
      'after',
      generateExamplesHelp([
        'netlify functions:create --name function-xyz',
        'netlify functions:build --name function-abc --timeout 30s',
      ]),
    )
    .addHelpText('after', generateCommandsHelp('functions', program))
    .action(functions)
}

module.exports = { createFunctionsCommand }
