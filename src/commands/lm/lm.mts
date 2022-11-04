// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createLmIn... Remove this comment to see the full error message
const { createLmInfoCommand } = require('./lm-info.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createLmIn... Remove this comment to see the full error message
const { createLmInstallCommand } = require('./lm-install.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createLmSe... Remove this comment to see the full error message
const { createLmSetupCommand } = require('./lm-setup.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createLmUn... Remove this comment to see the full error message
const { createLmUninstallCommand } = require('./lm-uninstall.cjs')

/**
 * The lm command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const lm = (options: $TSFixMe, command: $TSFixMe) => {
  command.help()
}

/**
 * Creates the `netlify lm` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createLmCo... Remove this comment to see the full error message
const createLmCommand = (program: $TSFixMe) => {
  createLmInfoCommand(program)
  createLmInstallCommand(program)
  createLmSetupCommand(program)
  createLmUninstallCommand(program)

  program
    .command('lm')
    .description('Handle Netlify Large Media operations\nThe lm command will help you manage large media for a site')
    .addExamples(['netlify lm:info', 'netlify lm:install', 'netlify lm:setup'])
    .action(lm)
}

module.exports = { createLmCommand }
