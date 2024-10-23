import { OptionValues } from 'commander'
import inquirer from 'inquirer'
import pick from 'lodash/pick.js'
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'pars... Remove this comment to see the full error message
import parseGitHubUrl from 'parse-github-url'
import { render } from 'prettyjson'

import { chalk, error, getTerminalLink, log, logJson, warn, APIError } from '../../utils/command-helpers.js'
import execa from '../../utils/execa.js'
import getRepoData from '../../utils/get-repo-data.js'
import { getGitHubToken } from '../../utils/init/config-github.js'
import { configureRepo } from '../../utils/init/config.js'
import { createRepo, getTemplatesFromGitHub, validateTemplate } from '../../utils/sites/utils.js'
import { track } from '../../utils/telemetry/index.js'
import BaseCommand from '../base-command.js'

import { getSiteNameInput } from './sites-create.js'

// @ts-expect-error TS(7006) FIXME: Parameter 'token' implicitly has an 'any' type.
export const fetchTemplates = async (token) => {
  const templatesFromGithubOrg = await getTemplatesFromGitHub(token)

  return (
    // @ts-expect-error TS(18046) - 'templatesFromGithubOrg' if of type 'unknown'
    templatesFromGithubOrg
      // @ts-expect-error TS(7006) FIXME: Parameter 'repo' implicitly has an 'any' type.
      .filter((repo) => !repo.archived && !repo.disabled)
      // @ts-expect-error TS(7006) FIXME: Parameter 'template' implicitly has an 'any' type.
      .map((template) => ({
        name: template.name,
        sourceCodeUrl: template.html_url,
        slug: template.full_name,
      }))
  )
}

// @ts-expect-error TS(7031) FIXME: Binding element 'ghToken' implicitly has an 'any' ... Remove this comment to see the full error message
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
      // @ts-expect-error TS(7006) FIXME: Parameter 'template' implicitly has an 'any' type.
      choices: templates.map((template) => ({
        value: template.slug,
        name: template.name,
      })),
    },
  ])

  return templateName
}

// @ts-expect-error TS(7031) FIXME: Binding element 'options' implicitly has an 'any' ... Remove this comment to see the full error message
const getGitHubLink = ({ options, templateName }) => options.url || `https://github.com/${templateName}`

export const sitesCreateTemplate = async (repository: string, options: OptionValues, command: BaseCommand) => {
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
        // @ts-expect-error TS(7006) FIXME: Parameter 'account' implicitly has an 'any' type.
        choices: accounts.map((account) => ({
          value: account.slug,
          name: account.name,
        })),
      },
    ])
    accountSlug = accountSlugInput
  }

  const { name: nameFlag } = options
  let site
  let repoResp: Awaited<ReturnType<typeof createRepo>>

  // Allow the user to reenter site name if selected one isn't available
  // @ts-expect-error TS(7006) FIXME: Parameter 'name' implicitly has an 'any' type.
  const inputSiteName = async (name) => {
    const { name: inputName } = await getSiteNameInput(name)

    class GitHubRepoError extends Error {
      status: string

      constructor(status: string, message: string) {
        super(message)
        this.status = status
        this.name = 'GitHubRepoError'
      }
    }

    const siteName = inputName.trim()
    try {
      const sites = await api.listSites({ name: siteName, filter: 'all' })
      // @ts-expect-error TS(7006) FIXME: Parameter 'filteredSite' implicitly has an 'any' t... Remove this comment to see the full error message
      const siteFoundByName = sites.find((filteredSite) => filteredSite.name === siteName)
      if (siteFoundByName) {
        console.log('A site with that name already exists')
        // @ts-expect-error TS(2554) FIXME: Expected 1 arguments, but got 0.
        return inputSiteName()
      }
    } catch (error_) {
      error(error_)
    }

    try {
      // Create new repo from template
      repoResp = await createRepo(templateName, ghToken, siteName || templateName)
      // @ts-expect-error TS(18046) - 'repoResp' if of type 'unknown'
      if (repoResp.errors && repoResp.errors[0].includes('Name already exists on this account')) {
        warn(
          `Oh no! We found already a repository with this name. It seems you have already created a template with the name ${templateName}. Please try to run the command again and provide a different name.`,
        )
        // @ts-expect-error TS(2554) FIXME: Expected 1 arguments, but got 0.
        return inputSiteName()
      }
      // @ts-expect-error TS(18046) - 'repoResp' if of type 'unknown'
      if (!repoResp.id) {
        throw new GitHubRepoError((repoResp as GitHubRepoError).status, (repoResp as GitHubRepoError).message)
      }
    } catch (error_) {
      if ((error_ as GitHubRepoError).status === '404') {
        error(
          `Could not retrieve repository: ${
            (error_ as GitHubRepoError).message
          } Ensure that your PAT has neccessary permissions.`,
        )
      } else {
        error(
          `Oops! Seems like something went wrong trying to create the repository. We're getting the following error: '${
            (error_ as GitHubRepoError).message
          }'. You can try to re-run this command again or open an issue in our repository: https://github.com/netlify/cli/issues`,
        )
      }
    }

    try {
      console.log('siteName', siteName)
      console.log('repoRespWithinTry', JSON.stringify(repoResp))
      site = await api.createSiteInTeam({
        accountSlug,
        body: {
          repo: {
            provider: 'github',
            // @ts-expect-error TS(18046) - 'repoResp' if of type 'unknown'
            repo: repoResp.full_name,
            // @ts-expect-error TS(18046) - 'repoResp' if of type 'unknown'
            private: repoResp.private,
            // @ts-expect-error TS(18046) - 'repoResp' if of type 'unknown'
            branch: repoResp.default_branch,
          },
          name: siteName,
        },
      })
    } catch (error_) {
      error(`createSiteInTeam error: ${(error_ as APIError).status}: ${(error_ as APIError).message}`)
    }
  }

  await inputSiteName(nameFlag)

  log()
  log(chalk.greenBright.bold.underline(`Site Created`))
  log()

  // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
  const siteUrl = site.ssl_url || site.url
  log(
    render({
      // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
      'Admin URL': site.admin_url,
      URL: siteUrl,
      // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
      'Site ID': site.id,
      // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
      'Repo URL': site.build_settings.repo_url,
    }),
  )

  track('sites_createdFromTemplate', {
    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
    siteId: site.id,
    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
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
    // @ts-expect-error TS(18046) - 'repoResp' if of type 'unknown'
    await execa('git', ['clone', repoResp.clone_url, `${repoResp.name}`])
    // @ts-expect-error TS(18046) - 'repoResp' if of type 'unknown'
    log(`🚀 Repository cloned successfully. You can find it under the ${chalk.magenta(repoResp.name)} folder`)
  }

  if (options.withCi) {
    log('Configuring CI')
    // @ts-expect-error TS(2345) FIXME: Argument of type '{ workingDir: any; }' is not ass... Remove this comment to see the full error message
    const repoData = await getRepoData({ workingDir: command.workingDir })
    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
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
