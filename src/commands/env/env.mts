// @ts-check

const { createEnvCloneCommand } = require('./env-clone.mjs')

const { createEnvGetCommand } = require('./env-get.mjs')

const { createEnvImportCommand } = require('./env-import.mjs')

const { createEnvListCommand } = require('./env-list.mjs')

const { createEnvSetCommand } = require('./env-set.mjs')

const { createEnvUnsetCommand } = require('./env-unset.mjs')

/**
 * The env command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */

const env = (options: $TSFixMe, command: $TSFixMe) => {
  command.help()
}

/**
 * Creates the `netlify env` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */

export const createEnvCommand = (program: $TSFixMe) => {
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
