// @ts-check
const { createLmInfoCommand } = require('./lm-info.cjs')
const { createLmInstallCommand } = require('./lm-install.cjs')
const { createLmSetupCommand } = require('./lm-setup.cjs')
const { createLmUninstallCommand } = require('./lm-uninstall.cjs')

/**
 * The lm command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
const lm = (options, command) => {
  command.help()
}

/**
 * Creates the `netlify lm` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
const createLmCommand = (program) => {
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
