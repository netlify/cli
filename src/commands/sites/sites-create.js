// @ts-check

const slugify = require('@sindresorhus/slugify')
const { InvalidArgumentError } = require('commander')
const inquirer = require('inquirer')
const pick = require('lodash/pick')
const sample = require('lodash/sample')
const prettyjson = require('prettyjson')
const { v4: uuidv4 } = require('uuid')

const { chalk, error, getRepoData, log, logJson, track, warn } = require('../../utils')
const { configureRepo } = require('../../utils/init/config')
const { link } = require('../link')

const SITE_NAME_SUGGESTION_SUFFIX_LENGTH = 5

const getSiteNameInput = async (name, user, api) => {
  let siteSuggestion
  if (!user) user = await api.getCurrentUser()

  if (!name) {
    let { slug } = user
    let suffix = ''

    // If the user doesn't have a slug, we'll compute one. Because `full_name` is not guaranteed to be unique, we
    // append a short randomly-generated ID to reduce the likelihood of a conflict.
    if (!slug) {
      slug = slugify(user.full_name || user.email)
      suffix = `-${uuidv4().slice(0, SITE_NAME_SUGGESTION_SUFFIX_LENGTH)}`
    }

    const suggestions = [
      `super-cool-site-by-${slug}${suffix}`,
      `the-awesome-${slug}-site${suffix}`,
      `${slug}-makes-great-sites${suffix}`,
      `netlify-thinks-${slug}-is-great${suffix}`,
      `the-great-${slug}-site${suffix}`,
      `isnt-${slug}-awesome${suffix}`,
    ]
    siteSuggestion = sample(suggestions)

    const { name: nameInput } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Site name (you can change it later):',
        default: siteSuggestion,
        validate: (input) =>
          /^[a-zA-Z\d-]+$/.test(input || undefined) || 'Only alphanumeric characters and hyphens are allowed',
      },
    ])
    name = nameInput || siteSuggestion
  }

  return { name, siteSuggestion }
}

/**
 * The sites:create command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const sitesCreate = async (options, command) => {
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
        choices: accounts.map((account) => ({
          value: account.slug,
          name: account.name,
        })),
      },
    ])
    accountSlug = accountSlugInput
  }

  let user
  let site

  // Allow the user to reenter site name if selected one isn't available
  const inputSiteName = async (name) => {
    const { name: siteName } = await getSiteNameInput(name, user, api)

    const body = {}
    if (typeof siteName === 'string') {
      body.name = siteName.trim()
    }
    try {
      site = await api.createSiteInTeam({
        accountSlug,
        body,
      })
    } catch (error_) {
      if (error_.status === 422) {
        warn(`${siteName}.netlify.app already exists. Please try a different slug.`)
        await inputSiteName()
      } else {
        error(`createSiteInTeam error: ${error_.status}: ${error_.message}`)
      }
    }
  }
  await inputSiteName(options.name)

  log()
  log(chalk.greenBright.bold.underline(`Site Created`))
  log()

  const siteUrl = site.ssl_url || site.url
  log(
    prettyjson.render({
      'Admin URL': site.admin_url,
      URL: siteUrl,
      'Site ID': site.id,
    }),
  )

  track('sites_created', {
    siteId: site.id,
    adminUrl: site.admin_url,
    siteUrl,
  })

  if (options.withCi) {
    log('Configuring CI')
    const repoData = await getRepoData()
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
    await link({ id: site.id }, command)
  }

  return site
}

const MAX_SITE_NAME_LENGTH = 63
const validateName = function (value) {
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
const createSitesCreateCommand = (program) =>
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
    .action(sitesCreate)

module.exports = { createSitesCreateCommand, sitesCreate, getSiteNameInput }
