// @ts-check

const clone = require('git-clone/promise')
const inquirer = require('inquirer')
const pick = require('lodash/pick')
const parseGitHubUrl = require('parse-github-url')
const prettyjson = require('prettyjson')

const { chalk, error, getRepoData, getTerminalLink, log, logJson, track, warn } = require('../../utils')
const { configureRepo } = require('../../utils/init/config')
const { getGitHubToken } = require('../../utils/init/config-github')
const { createRepo, getTemplatesFromGitHub, validateTemplate } = require('../../utils/sites/utils')

const { getSiteNameInput } = require('./sites-create')

const fetchTemplates = async (token) => {
  const templatesFromGithubOrg = await getTemplatesFromGitHub(token)

  return templatesFromGithubOrg
    .filter((repo) => !repo.archived && !repo.private && !repo.disabled)
    .map((template) => ({
      name: template.name,
      sourceCodeUrl: template.html_url,
      slug: template.full_name,
    }))
}

const getTemplateName = async ({ ghToken, options, repository }) => {
  if (repository) {
    const { repo } = parseGitHubUrl(repository)
    return repo || `netlify-templates/${repository}`
  }

  if (options.url) {
    const urlFromOptions = new URL(options.url)
    return urlFromOptions.pathname.slice(1)
  }

  const templates = await fetchTemplates(ghToken)

  log(`Choose one of our starter templates. Netlify will create a new repo for this template in your GitHub account.`)

  const { templateName } = await inquirer.prompt([
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

  return templateName
}

const getGitHubLink = ({ options, templateName }) => options.url || `https://github.com/${templateName}`

/**
 * The sites:create-template command
 * @param repository {string}
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const sitesCreateTemplate = async (repository, options, command) => {
  const { api } = command.netlify

  await command.authenticate()

  const { globalConfig } = command.netlify
  const ghToken = await getGitHubToken({ globalConfig })

  const templateName = await getTemplateName({ ghToken, options, repository })
  const { exists, isTemplate } = await validateTemplate({ templateName, ghToken })
  if (!exists) {
    const githubLink = getGitHubLink({ options, templateName })
    error(
      `Could not find template ${chalk.bold(templateName)}. Please verify it exists and you can ${getTerminalLink(
        'access to it on GitHub',
        githubLink,
      )}`,
    )
    return
  }
  if (!isTemplate) {
    const githubLink = getGitHubLink({ options, templateName })
    error(`${getTerminalLink(chalk.bold(templateName), githubLink)} is not a valid GitHub template`)
    return
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
  let repoResp

  // Allow the user to reenter site name if selected one isn't available
  const inputSiteName = async (name) => {
    const { name: inputName, siteSuggestion } = await getSiteNameInput(name, user, api)

    try {
      const siteName = inputName ? inputName.trim() : siteSuggestion

      // Create new repo from template
      repoResp = await createRepo(templateName, ghToken, siteName)

      if (repoResp.errors) {
        if (repoResp.errors[0].includes('Name already exists on this account')) {
          warn(
            `Oh no! We found already a repository with this name. It seems you have already created a template with the name ${templateName}. Please try to run the command again and provide a different name.`,
          )
          await inputSiteName()
        } else {
          throw new Error(
            `Oops! Seems like something went wrong trying to create the repository. We're getting the following error: '${repoResp.errors[0]}'. You can try to re-run this command again or open an issue in our repository: https://github.com/netlify/cli/issues`,
          )
        }
      } else {
        site = await api.createSiteInTeam({
          accountSlug,
          body: {
            repo: {
              provider: 'github',
              repo: repoResp.full_name,
              private: repoResp.private,
              branch: repoResp.default_branch,
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

  const { cloneConfirm } = await inquirer.prompt({
    type: 'confirm',
    name: 'cloneConfirm',
    message: `Do you want to clone the repository?`,
    default: true,
  })
  if (cloneConfirm) {
    log()
    await clone(repoResp.git_url, `${repoResp.name}`)
    log(`🚀 Repository cloned successfully. You can find it under the ${chalk.magenta(repoResp.name)} folder`)
  }

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
    .argument('[repository]', 'repository to use as starter template')
    .addHelpText('after', `(Beta) Create a site from starter template.`)
    .addExamples([
      'netlify sites:create-template',
      'netlify sites:create-template nextjs-blog-theme',
      'netlify sites:create-template my-github-profile/my-template',
    ])
    .action(sitesCreateTemplate)

module.exports = { createSitesFromTemplateCommand, fetchTemplates }
