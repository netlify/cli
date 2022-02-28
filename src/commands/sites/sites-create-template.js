const inquirer = require('inquirer')
const pick = require('lodash/pick')
const prettyjson = require('prettyjson')

const { chalk, error, getRepoData, log, logJson, track, warn } = require('../../utils')
const { configureRepo } = require('../../utils/init/config')
const { getGitHubToken } = require('../../utils/init/config-github')
const { createRepo, getTemplatesFromGitHub } = require('../../utils/sites/utils')

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
const templateExists = async (token, root, repoShorthand) => {
  const templatesFromGithubOrg = await getTemplatesFromGitHub(token)
  return templatesFromGithubOrg.some(
    (templateFromGithubOrg) =>
      templateFromGithubOrg.html_url === `https://github.com/${root ? `${root}/` : ''}${repoShorthand}`,
  )
}
const sitesCreateTemplate = async (repository,options, command) => {
  const netlifyTemplatesRepo = 'netlify-templates'
  const { api } = command.netlify
  await command.authenticate()
  const { globalConfig } = command.netlify
  const ghToken = await getGitHubToken({ globalConfig })
  let { url: templateUrl } = options
  if (repository) {
    let root
    if (await templateExists(ghToken, netlifyTemplatesRepo, repository)) {
      root = netlifyTemplatesRepo
    }
    const urlFromArg = new URL(`https://github.com/${root ? `${root}/` : ''}${repository}`)
    templateUrl = { templateName: urlFromArg.pathname.slice(1) }
  } else if (templateUrl) {
    const urlFromOptions = new URL(templateUrl)
    templateUrl = { templateName: urlFromOptions.pathname.slice(1) }
  } else {
    const templates = await fetchTemplates(ghToken)
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
  const inputSiteName = async (name) => {
    const { name: inputName, siteSuggestion } = await getSiteNameInput(name, user, api)
    try {
      const siteName = inputName ? inputName.trim() : siteSuggestion
      const repoResp = await createRepo(templateUrl, ghToken, siteName)
      if (repoResp.errors) {
        if (repoResp.errors[0].includes('Name already exists on this account')) {
          warn(
            `Oh no! We found already a repository with this name. It seems you have already created a template with the name ${templateUrl.templateName}. Please try to run the command again and provide a different name.`,
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
    .action(sitesCreateTemplate)
module.exports = { createSitesFromTemplateCommand, fetchTemplates }
