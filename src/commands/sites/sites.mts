
import { OptionValues , InvalidArgumentError } from 'commander'

import BaseCommand from '../base-command.mjs'

import { createSitesFromTemplateCommand } from './sites-create-template.mjs'
import { createSitesDeleteCommand } from './sites-delete.mjs'
import { createSitesListCommand } from './sites-list.mjs'

const MAX_SITE_NAME_LENGTH = 63
// @ts-expect-error TS(7006) FIXME: Parameter 'value' implicitly has an 'any' type.


const validateName = function (value) {
  // netlify sites:create --name <A string of more than 63 words>
  if (typeof value === 'string' && value.length > MAX_SITE_NAME_LENGTH) {
    throw new InvalidArgumentError(`--name should be less than 64 characters, input length: ${value.length}`)
  }

  return value
}

const sites = (options: OptionValues, command: BaseCommand) => {
  command.help()
}


export const createSitesCommand = (program: BaseCommand) => {
  program
  .command('sites:create')
  .description(
    `Create an empty site (advanced)
Create a blank site that isn't associated with any git remote. Will link the site to the current working directory.`,
  )
  .option('-n, --name <name>', 'name of site', validateName)
  .option('-a, --account-slug <slug>', 'account slug to create the site under')
  .option('-c, --with-ci', 'initialize CI hooks during site creation')
  .option('-m, --manual', 'force manual CI setup.  Used --with-ci flag')
  .option('--disable-linking', 'create the site without linking it to current directory')
  .addHelpText(
    'after',
    `Create a blank site that isn't associated with any git remote. Will link the site to the current working directory.`,
  )
  .action(async (options: OptionValues, command: BaseCommand) => {
    const { sitesCreate } = await import('./sites-create.mjs')
    await sitesCreate(options, command)
  })


  createSitesFromTemplateCommand(program)
  createSitesListCommand(program)
  createSitesDeleteCommand(program)

  return program
    .command('sites')
    .description(`Handle various site operations\nThe sites command will help you manage all your sites`)
    .addExamples(['netlify sites:create --name my-new-site', 'netlify sites:list'])
    .action(sites)
}
