// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createEnvC... Remove this comment to see the full error message
const { createEnvCloneCommand } = require('./env-clone.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createEnvG... Remove this comment to see the full error message
const { createEnvGetCommand } = require('./env-get.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createEnvI... Remove this comment to see the full error message
const { createEnvImportCommand } = require('./env-import.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createEnvL... Remove this comment to see the full error message
const { createEnvListCommand } = require('./env-list.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createEnvS... Remove this comment to see the full error message
const { createEnvSetCommand } = require('./env-set.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createEnvU... Remove this comment to see the full error message
const { createEnvUnsetCommand } = require('./env-unset.cjs')

/**
 * The env command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'env'.
const env = (options: $TSFixMe, command: $TSFixMe) => {
  command.help()
}

/**
 * Creates the `netlify env` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createEnvC... Remove this comment to see the full error message
const createEnvCommand = (program: $TSFixMe) => {
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
