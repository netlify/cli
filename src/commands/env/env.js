// @ts-check
const { createEnvGetCommand } = require('./env-get')
const { createEnvImportCommand } = require('./env-import')
const { createEnvListCommand } = require('./env-list')
const { createEnvMigrateCommand } = require('./env-migrate')
const { createEnvSetCommand } = require('./env-set')
const { createEnvUnsetCommand } = require('./env-unset')

/**
 * The env command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const env = (options, command) => {
  command.help()
}

/**
 * Creates the `netlify env` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createEnvCommand = (program) => {
  createEnvGetCommand(program)
  createEnvImportCommand(program)
  createEnvListCommand(program)
  createEnvSetCommand(program)
  createEnvUnsetCommand(program)
  createEnvMigrateCommand(program)

  return program
    .command('env')
    .description('(Beta) Control environment variables for the current site')
    .addExamples([
      'netlify env:list',
      'netlify env:get VAR_NAME',
      'netlify env:set VAR_NAME value',
      'netlify env:unset VAR_NAME',
      'netlify env:import fileName',
      'netlify env:migrate --to <to-site-id>',
    ])
    .action(env)
}

module.exports = { createEnvCommand }
