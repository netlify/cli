// @ts-check
import { createSitesFromTemplateCommand } from './sites-create-template.mjs'
import { createSitesCreateCommand } from './sites-create.mjs'
import { createSitesDeleteCommand } from './sites-delete.mjs'
import { createSitesListCommand } from './sites-list.mjs'

/**
 * The sites command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
const sites = (options, command) => {
  command.help()
}

/**
 * Creates the `netlify sites` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createSitesCommand = (program) => {
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
