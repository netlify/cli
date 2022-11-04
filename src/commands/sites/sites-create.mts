// @ts-check
const { InvalidArgumentError } = require('commander')

const inquirer = require('inquirer')

const pick = require('lodash/pick')

const prettyjson = require('prettyjson')


const { chalk, error, getRepoData, log, logJson, track, warn } = require('../../utils/index.mjs')

const { configureRepo } = require('../../utils/init/config.cjs')

const { link } = require('../link/index.cjs')


const getSiteNameInput = async (name: $TSFixMe) => {
  if (!name) {
    const { name: nameInput } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Site name (leave blank for a random name; you can change it later):',
        
        validate: (input: $TSFixMe) => /^[a-zA-Z\d-]+$/.test(input || undefined) || 'Only alphanumeric characters and hyphens are allowed',
      },
    ])
    name = nameInput || ''
  }

  return { name }
}

/**
 * The sites:create command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */

const sitesCreate = async (options: $TSFixMe, command: $TSFixMe) => {
  const { api } = command.netlify

  await command.authenticate()

  const accounts = await api.listAccountsForUser()

  let { accountSlug } = options
  if (!accountSlug) {
    const { accountSlug: accountSlugInput } = await inquirer.prompt([
      {
        type: 'list',
        name: 'accountSlug',
        message: 'Team:',
        
        choices: accounts.map((account: $TSFixMe) => ({
          value: account.slug,
          name: account.name
        })),
      },
    ])
    accountSlug = accountSlugInput
  }

  let site

  // Allow the user to reenter site name if selected one isn't available
  
  const inputSiteName = async (name: $TSFixMe) => {
    const { name: siteName } = await getSiteNameInput(name)

    const body = {}
    if (typeof siteName === 'string') {
      
      (body as $TSFixMe).name = siteName.trim();
    }
    try {
      site = await api.createSiteInTeam({
        accountSlug,
        body,
      })
    } catch (error_) {
      
      if ((error_ as $TSFixMe).status === 422) {
        warn(`${siteName}.netlify.app already exists. Please try a different slug.`)
        // @ts-expect-error TS(2554): Expected 1 arguments, but got 0.
        await inputSiteName()
      } else {
        
        error(`createSiteInTeam error: ${(error_ as $TSFixMe).status}: ${(error_ as $TSFixMe).message}`);
      }
    }
  }
  await inputSiteName(options.name)

  log()
  log(chalk.greenBright.bold.underline(`Site Created`))
  log()

  // @ts-expect-error TS(2532): Object is possibly 'undefined'.
  const siteUrl = site.ssl_url || site.url
  log(
    prettyjson.render({
      // @ts-expect-error TS(2532): Object is possibly 'undefined'.
      'Admin URL': site.admin_url,
      URL: siteUrl,
      // @ts-expect-error TS(2532): Object is possibly 'undefined'.
      'Site ID': site.id,
    }),
  )

  track('sites_created', {
    // @ts-expect-error TS(2532): Object is possibly 'undefined'.
    siteId: site.id,
    // @ts-expect-error TS(2532): Object is possibly 'undefined'.
    adminUrl: site.admin_url,
    siteUrl,
  })

  if (options.withCi) {
    log('Configuring CI')
    const repoData = await getRepoData()
    // @ts-expect-error TS(2532): Object is possibly 'undefined'.
    await configureRepo({ command, siteId: site.id, repoData, manual: options.manual })
  }

  if (options.json) {
    logJson(
      pick(site, [
        'id',
        'state',
        'plan',
        'name',
        'custom_domain',
        'domain_aliases',
        'url',
        'ssl_url',
        'admin_url',
        'screenshot_url',
        'created_at',
        'updated_at',
        'user_id',
        'ssl',
        'force_ssl',
        'managed_dns',
        'deploy_url',
        'account_name',
        'account_slug',
        'git_provider',
        'deploy_hook',
        'capabilities',
        'id_domain',
      ]),
    )
  }

  if (!options.disableLinking) {
    log()
    // @ts-expect-error TS(2532): Object is possibly 'undefined'.
    await link({ id: site.id }, command)
  }

  return site
}

const MAX_SITE_NAME_LENGTH = 63

const validateName = function (value: $TSFixMe) {
  // netlify sites:create --name <A string of more than 63 words>
  if (typeof value === 'string' && value.length > MAX_SITE_NAME_LENGTH) {
    throw new InvalidArgumentError(`--name should be less than 64 characters, input length: ${value.length}`)
  }

  return value
}

/**
 * Creates the `netlify sites:create` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */

const createSitesCreateCommand = (program: $TSFixMe) => program
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
  .action(sitesCreate)

module.exports = { createSitesCreateCommand, sitesCreate, getSiteNameInput }
