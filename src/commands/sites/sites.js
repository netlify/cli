// @ts-check
const { createSitesCreateCommand } = require('./sites-create')
const { createSitesFromTemplateCommand } = require('./sites-create-template')
const { createSitesDeleteCommand } = require('./sites-delete')
const { createSitesListCommand } = require('./sites-list')

/**
 * The sites command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').BaseCommand} command
 */
const sites = (options, command) => {
  command.help()
}

/**
 * Creates the `netlify sites` command
 * @param {import('../base-command.mjs').BaseCommand} program
 * @returns
 */
const createSitesCommand = (program) => {
  createSitesCreateCommand(program)
  createSitesFromTemplateCommand(program)
  createSitesListCommand(program)
  createSitesDeleteCommand(program)

  return program
    .command('sites')
    .description(`Handle various site operations\nThe sites command will help you manage all your sites`)
    .addExamples(['netlify sites:create --name my-new-site', 'netlify sites:list'])
    .action(sites)
}

module.exports = { createSitesCommand }
