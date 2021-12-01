// @ts-check

const { generateCommandsHelp, generateDescriptionHelp, generateExamplesHelp } = require('../../utils')

const { createLmInfoCommand } = require('./info')
const { createLmInstallCommand } = require('./install')
const { createLmSetupCommand } = require('./setup')
const { createLmUninstallCommand } = require('./uninstall')

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
    .description('Handle Netlify Large Media operations')
    .addHelpCommand('after', generateDescriptionHelp('The lm command will help you manage large media for a site'))
    .addHelpCommand('after', generateExamplesHelp(['netlify lm:info', 'netlify lm:install', 'netlify lm:setup']))
    .addHelpCommand('after', generateCommandsHelp('lm', program))
    .action(lm)
}

module.exports = { createLmCommand }
