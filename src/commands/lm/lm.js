// @ts-check
const { createLmInfoCommand } = require('./lm-info')
const { createLmInstallCommand } = require('./lm-install')
const { createLmSetupCommand } = require('./lm-setup')
const { createLmUninstallCommand } = require('./lm-uninstall')

/**
 * The lm command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const lm = (options, command) => {
  command.help()
}

/**
 * Creates the `netlify lm` command
 * @param {import('../base-command').BaseCommand} program
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
