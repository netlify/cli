// @ts-check

const { createSitesFromTemplateCommand } = require('./sites-create-template.mjs')

const { createSitesCreateCommand } = require('./sites-create.mjs')

const { createSitesDeleteCommand } = require('./sites-delete.mjs')

const { createSitesListCommand } = require('./sites-list.mjs')

/**
 * The sites command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */

const sites = (options: $TSFixMe, command: $TSFixMe) => {
  command.help()
}

/**
 * Creates the `netlify sites` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */

export const createSitesCommand = (program: $TSFixMe) => {
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

export default { createSitesCommand }
