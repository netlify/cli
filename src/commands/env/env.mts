// @ts-check
const { createEnvCloneCommand } = require('./env-clone.cjs')
const { createEnvGetCommand } = require('./env-get.cjs')
const { createEnvImportCommand } = require('./env-import.cjs')
const { createEnvListCommand } = require('./env-list.cjs')
const { createEnvSetCommand } = require('./env-set.cjs')
const { createEnvUnsetCommand } = require('./env-unset.cjs')

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
  createEnvCloneCommand(program)

  return program
    .command('env')
    .description('Control environment variables for the current site')
    .addExamples([
      'netlify env:list',
      'netlify env:get VAR_NAME',
      'netlify env:set VAR_NAME value',
      'netlify env:unset VAR_NAME',
      'netlify env:import fileName',
      'netlify env:clone --to <to-site-id>',
    ])
    .action(env)
}

module.exports = { createEnvCommand }
