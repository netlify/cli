// @ts-check

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'inquirer'.
const inquirer = require('inquirer')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'pick'.
const pick = require('lodash/pick')
const parseGitHubUrl = require('parse-github-url')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'prettyjson... Remove this comment to see the full error message
const prettyjson = require('prettyjson')

const {
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'chalk'.
  chalk,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'error'.
  error,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'execa'.
  execa,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getRepoDat... Remove this comment to see the full error message
  getRepoData,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getTermina... Remove this comment to see the full error message
  getTerminalLink,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'log'.
  log,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'logJson'.
  logJson,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'track'.
  track,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'warn'.
  warn,
} = require('../../utils/index.mjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getGitHubT... Remove this comment to see the full error message
const { getGitHubToken } = require('../../utils/init/config-github.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'configureR... Remove this comment to see the full error message
const { configureRepo } = require('../../utils/init/config.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createRepo... Remove this comment to see the full error message
const { createRepo, getTemplatesFromGitHub, validateTemplate } = require('../../utils/sites/utils.cjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getSiteNam... Remove this comment to see the full error message
const { getSiteNameInput } = require('./sites-create.cjs')

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const fetchTemplates = async (token: $TSFixMe) => {
  const templatesFromGithubOrg = await getTemplatesFromGitHub(token)

  return templatesFromGithubOrg
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    .filter((repo: $TSFixMe) => !repo.archived && !repo.disabled)
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    .map((template: $TSFixMe) => ({
    name: template.name,
    sourceCodeUrl: template.html_url,
    slug: template.full_name
  }));
}

const getTemplateName = async ({
  ghToken,
  options,
  repository
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
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
      // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
      choices: templates.map((template: $TSFixMe) => ({
        value: template.slug,
        name: template.name
      })),
    },
  ])

  return templateName
}

const getGitHubLink = ({
  options,
  templateName
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => options.url || `https://github.com/${templateName}`

/**
 * The sites:create-template command
 * @param repository {string}
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const sitesCreateTemplate = async (repository: $TSFixMe, options: $TSFixMe, command: $TSFixMe) => {
  const { api } = command.netlify

  await command.authenticate()

  const { globalConfig } = command.netlify
  // @ts-expect-error TS(2554): Expected 0 arguments, but got 1.
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
        // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
        choices: accounts.map((account: $TSFixMe) => ({
          value: account.slug,
          name: account.name
        })),
      },
    ])
    accountSlug = accountSlugInput
  }

  const { name: nameFlag } = options
  let site
  let repoResp

  // Allow the user to reenter site name if selected one isn't available
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  const inputSiteName = async (name: $TSFixMe) => {
    const { name: inputName } = await getSiteNameInput(name)

    try {
      const siteName = inputName.trim()

      // Create new repo from template
      repoResp = await createRepo(templateName, ghToken, siteName || templateName)

      if (repoResp.errors) {
        if (repoResp.errors[0].includes('Name already exists on this account')) {
          warn(
            `Oh no! We found already a repository with this name. It seems you have already created a template with the name ${templateName}. Please try to run the command again and provide a different name.`,
          )
          // @ts-expect-error TS(2554): Expected 1 arguments, but got 0.
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
      // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
      if ((error_ as $TSFixMe).status === 422 || (error_ as $TSFixMe).message === 'Duplicate repo') {
        warn(
          `${name}.netlify.app already exists or a repository named ${name} already exists on this account. Please try a different slug.`,
        )
        // @ts-expect-error TS(2554): Expected 1 arguments, but got 0.
        await inputSiteName()
      } else {
        // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
        error(`createSiteInTeam error: ${(error_ as $TSFixMe).status}: ${(error_ as $TSFixMe).message}`);
      }
    }
  }

  await inputSiteName(nameFlag)

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
      // @ts-expect-error TS(2532): Object is possibly 'undefined'.
      'Repo URL': site.build_settings.repo_url,
    }),
  )

  track('sites_createdFromTemplate', {
    // @ts-expect-error TS(2532): Object is possibly 'undefined'.
    siteId: site.id,
    // @ts-expect-error TS(2532): Object is possibly 'undefined'.
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
    // @ts-expect-error TS(2532): Object is possibly 'undefined'.
    await execa('git', ['clone', repoResp.clone_url, `${repoResp.name}`])
    // @ts-expect-error TS(2532): Object is possibly 'undefined'.
    log(`🚀 Repository cloned successfully. You can find it under the ${chalk.magenta(repoResp.name)} folder`)
  }

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

  return site
}

/**
 * Creates the `netlify sites:create-template` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createSite... Remove this comment to see the full error message
const createSitesFromTemplateCommand = (program: $TSFixMe) => program
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
