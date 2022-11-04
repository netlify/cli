// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createSite... Remove this comment to see the full error message
const { createSitesFromTemplateCommand } = require('./sites-create-template.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createSite... Remove this comment to see the full error message
const { createSitesCreateCommand } = require('./sites-create.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createSite... Remove this comment to see the full error message
const { createSitesDeleteCommand } = require('./sites-delete.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createSite... Remove this comment to see the full error message
const { createSitesListCommand } = require('./sites-list.cjs')

/**
 * The sites command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const sites = (options: $TSFixMe, command: $TSFixMe) => {
  command.help()
}

/**
 * Creates the `netlify sites` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createSite... Remove this comment to see the full error message
const createSitesCommand = (program: $TSFixMe) => {
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
