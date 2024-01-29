import { OptionValues } from 'commander'
import pick from 'lodash/pick.js'
import prettyjson from 'prettyjson'

import getRepoData from '../../utils/get-repo-data.js'
import { configureRepo } from '../../utils/init/config.js'
import { track } from '../../utils/telemetry/index.js'
import BaseCommand from '../base-command.js'
import { link } from '../link/link.js'
import { NetlifyLog, SelectOptions, intro, outro, select, text } from '../../utils/styles/index.js'

// @ts-expect-error TS(7006) FIXME: Parameter 'name' implicitly has an 'any' type.
export const getSiteNameInput = async (name) => {
  if (!name) {
    name = await text({
      message: 'Site name (leave blank for a random name; you can change it later):',
      validate: (input) => {
        const regex = /^[a-zA-Z\d-]+$/
        const valid = regex.test(input)
        if (!valid) return 'Only alphanumeric characters and hyphens are allowed'
      },
    })
  }

  return { name }
}

export const sitesCreate = async (options: OptionValues, command: BaseCommand) => {
  !options.isChildCommand && intro('sites:create')
  const { api } = command.netlify

  await command.authenticate()

  const accounts = await api.listAccountsForUser()

  let { accountSlug } = options
  if (!accountSlug) {
    const accountSelectOptions: SelectOptions<string> = {
      // @ts-expect-error TS(7006) FIXME: Parameter 'account' implicitly has an 'any' type.
      options: accounts.map((account) => ({
        value: account.slug,
        label: account.name,
      })),
      message: 'Team:',
    }

    accountSlug = await select(accountSelectOptions)
  }

  let site

  // Allow the user to reenter site name if selected one isn't available
  // @ts-expect-error TS(7006) FIXME: Parameter 'name' implicitly has an 'any' type.
  const inputSiteName = async (name) => {
    const { name: siteName } = await getSiteNameInput(name)

    const body = {}
    if (typeof siteName === 'string') {
      // @ts-expect-error TS(2339) FIXME: Property 'name' does not exist on type '{}'.
      body.name = siteName.trim()
    }
    try {
      site = await api.createSiteInTeam({
        accountSlug,
        body,
      })
    } catch (error_) {
      // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
      if (error_.status === 422) {
        NetlifyLog.warn(`${siteName}.netlify.app already exists. Please try a different slug.`)
        // @ts-expect-error TS(2554) FIXME: Expected 1 arguments, but got 0.
        await inputSiteName()
      } else {
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        NetlifyLog.error(`createSiteInTeam error: ${error_.status}: ${error_.message}`)
        outro({ exit: true, message: 'Error creating site' })
      }
    }
  }
  await inputSiteName(options.name)

  // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
  const siteUrl = site.ssl_url || site.url
  NetlifyLog.info(
    prettyjson.render({
      // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
      'Admin URL': site.admin_url,
      URL: siteUrl,
      // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
      'Site ID': site.id,
    }),
  )

  track('sites_created', {
    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
    siteId: site.id,
    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
    adminUrl: site.admin_url,
    siteUrl,
  })

  if (options.withCi) {
    NetlifyLog.info('Configuring CI')
    // @ts-expect-error TS(2345) FIXME: Argument of type '{ workingDir: any; }' is not ass... Remove this comment to see the full error message
    const repoData = await getRepoData({ workingDir: command.workingDir })
    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
    await configureRepo({ command, siteId: site.id, repoData, manual: options.manual })
  }

  if (options.json) {
    NetlifyLog.info(
      prettyjson.render(
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
      ),
    )
  }

  if (!options.disableLinking) {
    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
    await link({ id: site.id, isChildCommand: true }, command)
  }

  !options.isChildCommand && outro({ exit: true, message: `Site Created` })
  return site
}
