// @ts-check

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createAddo... Remove this comment to see the full error message
const { createAddonsAuthCommand } = require('./addons-auth.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createAddo... Remove this comment to see the full error message
const { createAddonsConfigCommand } = require('./addons-config.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createAddo... Remove this comment to see the full error message
const { createAddonsCreateCommand } = require('./addons-create.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createAddo... Remove this comment to see the full error message
const { createAddonsDeleteCommand } = require('./addons-delete.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createAddo... Remove this comment to see the full error message
const { createAddonsListCommand } = require('./addons-list.cjs')

/**
 * The addons command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const addons = (options: $TSFixMe, command: $TSFixMe) => {
  command.help()
}

/**
 * Creates the `netlify addons` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createAddo... Remove this comment to see the full error message
const createAddonsCommand = (program: $TSFixMe) => {
  createAddonsAuthCommand(program)
  createAddonsConfigCommand(program)
  createAddonsCreateCommand(program)
  createAddonsDeleteCommand(program)
  createAddonsListCommand(program)

  return program
    .command('addons')
    .alias('addon')
    .description('(Beta) Manage Netlify Add-ons')
    .noHelpOptions()
    .addExamples([
      'netlify addons:create addon-xyz',
      'netlify addons:list',
      'netlify addons:config addon-xyz',
      'netlify addons:delete addon-xyz',
      'netlify addons:auth addon-xyz',
    ])
    .action(addons)
}
module.exports = { createAddonsCommand }
