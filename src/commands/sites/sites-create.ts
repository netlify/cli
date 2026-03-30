import type { OptionValues } from 'commander'
import inquirer from 'inquirer'
import pick from 'lodash/pick.js'
import prettyjson from 'prettyjson'

import { chalk, logAndThrowError, log, logJson, warn, type APIError } from '../../utils/command-helpers.js'
import getRepoData from '../../utils/get-repo-data.js'
import { configureRepo } from '../../utils/init/config.js'
import { isInteractive } from '../../utils/scripted-commands.js'
import { resolveTeamForNonInteractive } from '../../utils/team.js'
import { track } from '../../utils/telemetry/index.js'
import type { SiteInfo } from '../../utils/types.js'
import { MAX_SITE_NAME_LENGTH } from '../../utils/validation.js'
import type BaseCommand from '../base-command.js'
import { link } from '../link/link.js'

export const getSiteNameInput = async (name: string | undefined): Promise<{ name: string }> => {
  if (!name) {
    const { name: nameInput } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Project name (leave blank for a random name; you can change it later):',
        validate: (input) =>
          /^[a-zA-Z\d-]+$/.test(input || undefined) || 'Only alphanumeric characters and hyphens are allowed',
      },
    ])
    name = typeof nameInput === 'string' ? nameInput : ''
  }

  return { name }
}

export const sitesCreate = async (options: OptionValues, command: BaseCommand) => {
  const { accounts, api } = command.netlify

  await command.authenticate()

  let accountSlug = options.accountSlug as string | undefined
  if (!accountSlug) {
    if (!isInteractive()) {
      const team = resolveTeamForNonInteractive(
        accounts,
        'netlify sites:create --name <SITE_NAME> --account-slug <TEAM_SLUG>',
      )
      accountSlug = team.slug
      log(`Using team: ${team.name}`)
    } else {
      const { accountSlug: accountSlugInput }: { accountSlug: string } = await inquirer.prompt<
        Promise<{ accountSlug: string }>
      >([
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
  }

  let site!: SiteInfo

  const MAX_NAME_RETRIES = 2

  const createSiteWithRetry = async (siteName: string | undefined) => {
    let nameAttempt = siteName
    let retries = 0

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      const body: { name?: string } = {}
      if (typeof nameAttempt === 'string' && nameAttempt.trim()) {
        body.name = nameAttempt.trim()
      }

      try {
        site = (await api.createSiteInTeam({
          accountSlug: accountSlug,
          body,
        })) as unknown as SiteInfo
        break
      } catch (error_) {
        if ((error_ as APIError).status === 422) {
          if (!isInteractive() && siteName && retries < MAX_NAME_RETRIES) {
            retries++
            const suffix = `-${Math.floor(Math.random() * 900 + 100).toString()}`
            const normalizedBase = siteName.trim()
            const maxBaseLength = MAX_SITE_NAME_LENGTH - suffix.length
            const truncatedBase = normalizedBase.slice(0, maxBaseLength)
            nameAttempt = `${truncatedBase}${suffix}`
            warn(`${siteName}.netlify.app already exists. Trying ${nameAttempt}...`)
            continue
          }

          if (isInteractive()) {
            warn(`${nameAttempt || 'Site name'}.netlify.app already exists. Please try a different slug.`)
            const { name: newSiteName } = await getSiteNameInput(undefined)
            nameAttempt = newSiteName
            continue
          }

          return logAndThrowError(
            siteName
              ? `Project name "${nameAttempt}" is already taken. Please try a different name.`
              : 'Failed to create site: name already taken',
          )
        }

        return logAndThrowError(
          `createSiteInTeam error: ${(error_ as APIError).status}: ${(error_ as APIError).message}`,
        )
      }
    }
  }

  if (!isInteractive() && !options.name) {
    try {
      site = (await api.createSiteInTeam({
        accountSlug: accountSlug,
        body: {},
      })) as unknown as SiteInfo
    } catch (error_) {
      return logAndThrowError(`Failed to create site: ${(error_ as APIError).status}: ${(error_ as APIError).message}`)
    }
  } else if (isInteractive() && !options.name) {
    const { name: siteName } = await getSiteNameInput(options.name)
    await createSiteWithRetry(siteName)
  } else {
    await createSiteWithRetry(options.name)
  }

  log()
  log(chalk.greenBright.bold.underline(`Project Created`))
  log()

  const siteUrl = site.ssl_url || site.url
  log(
    prettyjson.render({
      'Admin URL': site.admin_url,
      URL: siteUrl,
      'Project ID': site.id,
    }),
  )

  track('sites_created', {
    siteId: site.id,
    adminUrl: site.admin_url,
    siteUrl,
  })

  if (options.withCi) {
    log('Configuring CI')
    const repoData = await getRepoData({ workingDir: command.workingDir })

    if ('error' in repoData) {
      return logAndThrowError('Failed to get repo data')
    }

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
