const { chalk, showHelp } = require('../../utils')

const { createEnvGetCommand } = require('./get')

/**
 * The env command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const env = (options, command) => {
  showHelp(command.name())
}

/**
 * The env:import command
 * @param {string} fileName The .env file to import
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const envImport = async (fileName, options, command) => {
  console.log('env:import command with options', options, fileName)
}

/**
 * Creates the `netlify env` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createEnvCommand = (program) => {
  program
    .command('env')
    .description('(Beta) Control environment variables for the current site')
    .addHelpText(
      'after',
      `
${chalk.bold('EXAMPLES')}
  $ netlify env:list
  $ netlify env:get VAR_NAME
  $ netlify env:set VAR_NAME value
  $ netlify env:unset VAR_NAME
  $ netlify env:import fileName
`,
    )
    .action(env)

  createEnvGetCommand(program)

  program.command('env:list').description('Lists resolved environment variables for site (includes netlify.toml)')

  program
    .command('env:import <fileName>')
    .description('Import and set environment variables from .env file', {
      fileName: '.env file to import',
    })
    .option(
      '-r, --replaceExisting',
      'Replace all existing variables instead of merging them with the current ones',
      false,
    )
    .action(envImport)
  return program
}

module.exports = { createEnvCommand }
