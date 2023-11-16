
import { OptionValues , InvalidArgumentError } from 'commander'

import BaseCommand from '../base-command.mjs'

import { createSitesDeleteCommand } from './sites-delete.mjs'

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


  program
    .command('sites:create-template')
    .description(
      `(Beta) Create a site from a starter template
Create a site from a starter template.`,
    )
    .option('-n, --name [name]', 'name of site')
    .option('-u, --url [url]', 'template url')
    .option('-a, --account-slug [slug]', 'account slug to create the site under')
    .option('-c, --with-ci', 'initialize CI hooks during site creation')
    .argument('[repository]', 'repository to use as starter template')
    .addHelpText('after', `(Beta) Create a site from starter template.`)
    .addExamples([
      'netlify sites:create-template',
      'netlify sites:create-template nextjs-blog-theme',
      'netlify sites:create-template my-github-profile/my-template',
    ])
    .action(async (repository: string, options: OptionValues, command: BaseCommand) => {
      const { sitesCreateTemplate } = await import('./sites-create-template.mjs')
      await sitesCreateTemplate(repository, options, command)
    })

    program
    .command('sites:list')
    .description('List all sites you have access to')
    .option('--json', 'Output site data as JSON')
    .action(async (options: OptionValues, command: BaseCommand) => {
      const {sitesList} = await import('./sites-list.mjs')
      await sitesList(options, command)
    })


  createSitesDeleteCommand(program)

  return program
    .command('sites')
    .description(`Handle various site operations\nThe sites command will help you manage all your sites`)
    .addExamples(['netlify sites:create --name my-new-site', 'netlify sites:list'])
    .action(sites)
}
