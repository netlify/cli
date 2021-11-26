const { generateCommandsHelp, generateExamplesHelp, showHelp } = require('../../utils')

const { createOpenAdminCommand, openAdmin } = require('./open-admin')
const { createOpenSiteCommand, openSite } = require('./open-site')

/**
 * The open command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const open = async (options, command) => {
  if (!options.site || !options.admin) {
    showHelp(command.name())
  }

  if (options.site) {
    await openSite(options, command)
  }
  // Default open netlify admin
  await openAdmin(options, command)
}

/**
 * Creates the `netlify open` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createOpenCommand = (program) => {
  createOpenAdminCommand(program)
  createOpenSiteCommand(program)

  return program
    .command('open')
    .description('Open settings for the site linked to the current folder')
    .addHelpText(
      'after',
      generateExamplesHelp(['netlify open --site', 'netlify open --admin', 'netlify open:admin', 'netlify open:site']),
    )
    .addHelpText('after', generateCommandsHelp('open', program))
    .action(open)
}
module.exports = { createOpenCommand }
