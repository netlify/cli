import { OptionValues } from 'commander'
import inquirer from 'inquirer'
import pick from 'lodash/pick.js'
import { render } from 'prettyjson'

import {
  chalk,
  error,
  getTerminalLink,
  log,
  logJson,
  warn,
  APIError,
  GitHubAPIError,
} from '../../utils/command-helpers.js'
import execa from '../../utils/execa.js'
import getRepoData from '../../utils/get-repo-data.js'
import { getGitHubToken } from '../../utils/init/config-github.js'
import { configureRepo } from '../../utils/init/config.js'
import {
  createRepo,
  getGitHubLink,
  getTemplateName,
  validateTemplate,
  deployedSiteExists,
} from '../../utils/sites/utils.js'
import { track } from '../../utils/telemetry/index.js'
import BaseCommand from '../base-command.js'

import { getSiteNameInput } from './sites-create.js'

export const sitesCreateTemplate = async (repository: string, options: OptionValues, command: BaseCommand) => {
  console.log('basecommand', command)
  log('asdfsaf HERE!!!!!')
  log('THERE!!')
  const { api } = command.netlify
  await command.authenticate()

  const { globalConfig } = command.netlify
  console.log('before getGitHubToken')
  const ghToken = await getGitHubToken({ globalConfig })
  console.log('after getGitHubToken', ghToken)
  const templateName = await getTemplateName({ ghToken, options, repository })
  console.log('after getTemplateName')
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
  console.log('before listAccountsForUser')
  const accounts = await api.listAccountsForUser()
  console.log('after listAccountsForUser')
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
  const inputSiteName = async (name?, existingRepoName?) => {
    console.log('name type', typeof name)
    const { name: inputName } = await getSiteNameInput(name)

    const siteName = inputName.trim()

    if (await deployedSiteExists(siteName)) {
      log('A site with that name already exists!!!!')
      return inputSiteName()
    }
    // get z.netlify.app
    //

    log('right before the try block')
    try {
      const sites = await api.listSites({ name: siteName, filter: 'all' })
      log('right after the listsites call')
      // @ts-expect-error TS(7006) FIXME: Parameter 'filteredSite' implicitly has an 'any' t... Remove this comment to see the full error message
      const siteFoundByName = sites.find((filteredSite) => filteredSite.name === siteName)
      if (siteFoundByName) {
        log('A site with that name already exists')
        return inputSiteName()
      }
    } catch (error_) {
      error(error_)
    }

    if (!existingRepoName) {
      try {
        // Create new repo from template
        repoResp = await createRepo(templateName, ghToken, siteName || templateName)
        // @ts-expect-error TS(18046) - 'repoResp' if of type 'unknown'
        if (repoResp.errors && repoResp.errors[0].includes('Name already exists on this account')) {
          warn(
            `It seems you have already created a template with the name ${templateName}. Please try to run the command again and provide a different name.`,
          )
          return inputSiteName()
        }
        // @ts-expect-error TS(18046) - 'repoResp' if of type 'unknown'
        if (!repoResp.id) {
          throw new GitHubAPIError((repoResp as GitHubAPIError).status, (repoResp as GitHubAPIError).message)
        }
        existingRepoName = siteName || templateName
      } catch (error_) {
        if ((error_ as GitHubAPIError).status === '404') {
          error(
            `Could not retrieve repository: ${
              (error_ as GitHubAPIError).message
            } Ensure that your PAT has neccessary permissions.`,
          )
        } else {
          error(
            `Something went wrong trying to create the repository. We're getting the following error: '${
              (error_ as GitHubAPIError).message
            }'. You can try to re-run this command again or open an issue in our repository: https://github.com/netlify/cli/issues`,
          )
        }
      }
    }

    try {
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
      if ((error_ as APIError).status === 422) {
        // 422: Unprocessable entity
        log(`createSiteInTeam error: ${(error_ as APIError).status}: ${(error_ as APIError).message}`)
        log('Cannot create a site with that name. Please try a new name.')
        log('Site name may already exist globally')
        return inputSiteName(undefined, existingRepoName)
      }
      error(`createSiteInTeam error: ${(error_ as APIError).status}: ${(error_ as APIError).message}`)
    }
  }

  log('right before inputsitename')
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
