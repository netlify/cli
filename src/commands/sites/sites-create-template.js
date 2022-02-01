// @ts-check

const slugify = require('@sindresorhus/slugify')
const inquirer = require('inquirer')
const pick = require('lodash/pick')
const sample = require('lodash/sample')
const fetch = require('node-fetch')
const prettyjson = require('prettyjson')
const { v4: uuidv4 } = require('uuid')

const { chalk, error, getRepoData, log, logJson, track, warn } = require('../../utils')
const { configureRepo } = require('../../utils/init/config')
const { getGitHubToken } = require('../../utils/init/config-github')

const SITE_NAME_SUGGESTION_SUFFIX_LENGTH = 5

let ghToken

const fetchTemplates = async (token) => {
  const templatesFromGithubOrg = await fetch(`https://api.github.com/orgs/netlify-templates/repos`, {
    method: 'GET',
    headers: {
      Authorization: `token ${token}`,
    },
  })
  const allTemplates = await templatesFromGithubOrg.json()

  return allTemplates
    .filter((repo) => !repo.archived && !repo.private && !repo.disabled)
    .map((template) => ({
      name: template.name,
      sourceCodeUrl: template.html_url,
      slug: template.full_name,
    }))
}

/**
 * The sites:create-template command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const sitesCreate = async (options, command) => {
  const { api } = command.netlify

  await command.authenticate()

  const { globalConfig } = command.netlify
  ghToken = await getGitHubToken({ globalConfig })

  const templates = await fetchTemplates(ghToken)

  let { url: templateUrl } = options

  if (templateUrl) {
    const urlFromOptions = new URL(templateUrl)
    templateUrl = { templateName: urlFromOptions.pathname.slice(1) }
  } else {
    log(`Choose one of our starter templates. Netlify will create a new repo for this template in your GitHub account.`)

    templateUrl = await inquirer.prompt([
      {
        type: 'list',
        name: 'templateName',
        message: 'Template:',
        choices: templates.map((template) => ({
          value: template.slug,
          name: template.name,
        })),
      },
    ])
  }

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

  const { name: nameFlag } = options
  let user
  let site

  // Allow the user to reenter site name if selected one isn't available
  const inputSiteName = async (name) => {
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

      log(
        `Choose a unique site name (e.g. ${siteSuggestion}.netlify.app) or leave it blank for a random name. You can update the site name later.`,
      )
      const { name: nameInput } = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Site name (optional):',
          filter: (val) => (val === '' ? undefined : val),
          validate: (input) => /^[a-zA-Z\d-]+$/.test(input) || 'Only alphanumeric characters and hyphens are allowed',
        },
      ])
      name = nameInput
    }

    try {
      const siteName = name ? name.trim() : siteSuggestion

      // Create new repo from template
      const createGhRepoResp = await fetch(`https://api.github.com/repos/${templateUrl.templateName}/generate`, {
        method: 'POST',
        headers: {
          Authorization: `token ${ghToken}`,
        },
        body: JSON.stringify({
          name: siteName,
        }),
      })
      const resp = await createGhRepoResp.json()

      if (resp.errors) {
        if (resp.errors[0].includes('Name already exists on this account')) {
          warn(
            `Oh no! We found already a repository with this name. It seems you have already created a template with the name ${templateUrl.templateName}. Please try to run the command again and provide a different name.`,
          )
          await inputSiteName()
        } else {
          throw new Error(
            `Oops! Seems like something went wrong trying to create the repository. We're getting the following error: '${resp.errors[0]}'. You can try to re-run this command again or open an issue in our repository: https://github.com/netlify/cli/issues`,
          )
        }
      } else {
        site = await api.createSiteInTeam({
          accountSlug,
          body: {
            repo: {
              provider: 'github',
              repo: resp.full_name,
              private: resp.private,
              branch: resp.default_branch,
            },
            name: siteName,
          },
        })
      }
    } catch (error_) {
      if (error_.status === 422 || error_.message === 'Duplicate repo') {
        warn(
          `${name}.netlify.app already exists or a repository named ${name} already exists on this account. Please try a different slug.`,
        )
        await inputSiteName()
      } else {
        error(`createSiteInTeam error: ${error_.status}: ${error_.message}`)
      }
    }
  }

  await inputSiteName(nameFlag)

  log()
  log(chalk.greenBright.bold.underline(`Site Created`))
  log()

  const siteUrl = site.ssl_url || site.url
  log(
    prettyjson.render({
      'Admin URL': site.admin_url,
      URL: siteUrl,
      'Site ID': site.id,
      'Repo URL': site.build_settings.repo_url,
    }),
  )

  track('sites_createdFromTemplate', {
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

  return site
}

/**
 * Creates the `netlify sites:create-template` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createSitesFromTemplateCommand = (program) =>
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
    .addHelpText('after', `(Beta) Create a site from starter template.`)
    .action(sitesCreate)

module.exports = { createSitesFromTemplateCommand }
