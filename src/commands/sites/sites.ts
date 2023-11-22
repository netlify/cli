import { createSitesFromTemplateCommand } from './sites-create-template.js'
import { createSitesCreateCommand } from './sites-create.js'
import { createSitesDeleteCommand } from './sites-delete.js'
import { createSitesListCommand } from './sites-list.js'

/**
 * The sites command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.js').default} command
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'options' implicitly has an 'any' type.
const sites = (options, command) => {
  command.help()
}

/**
 * Creates the `netlify sites` command
 * @param {import('../base-command.js').default} program
 * @returns
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'program' implicitly has an 'any' type.
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
