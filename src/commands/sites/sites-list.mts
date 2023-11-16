
import { OptionValues } from 'commander'

import { listSites } from '../../lib/api.mjs'
import { startSpinner, stopSpinner } from '../../lib/spinner.mjs'
import { chalk, log, logJson } from '../../utils/command-helpers.mjs'
import BaseCommand from '../base-command.mjs'


export const sitesList = async (options: OptionValues, command: BaseCommand) => {
  const { api } = command.netlify
  /** @type {import('ora').Ora} */
  let spinner
  if (!options.json) {
    spinner = startSpinner({ text: 'Loading your sites' })
  }
  await command.authenticate()

  const sites = await listSites({ api, options: { filter: 'all' } })
  if (!options.json) {
    // @ts-expect-error TS(2345) FIXME: Argument of type '{ spinner: Ora | undefined; }' i... Remove this comment to see the full error message
    stopSpinner({ spinner })
  }

  if (sites && sites.length !== 0) {
    // @ts-expect-error TS(7006) FIXME: Parameter 'site' implicitly has an 'any' type.
    const logSites = sites.map((site) => {
      const siteInfo = {
        id: site.id,
        name: site.name,
        ssl_url: site.ssl_url,
        account_name: site.account_name,
      }

      if (site.build_settings && site.build_settings.repo_url) {
        // @ts-expect-error TS(2339) FIXME: Property 'repo_url' does not exist on type '{ id: ... Remove this comment to see the full error message
        siteInfo.repo_url = site.build_settings.repo_url
      }

      return siteInfo
    })

    // Json response for piping commands
    if (options.json) {
      // @ts-expect-error TS(7006) FIXME: Parameter 'site' implicitly has an 'any' type.
      const redactedSites = sites.map((site) => {
        if (site && site.build_settings) {
          delete site.build_settings.env
        }
        return site
      })
      logJson(redactedSites)
      return false
    }

    log(`
────────────────────────────┐
 Current Netlify Sites    │
────────────────────────────┘

Count: ${logSites.length}
`)

    // @ts-expect-error TS(7006) FIXME: Parameter 'logSite' implicitly has an 'any' type.
    logSites.forEach((logSite) => {
      log(`${chalk.greenBright(logSite.name)} - ${logSite.id}`)
      log(`  ${chalk.whiteBright.bold('url:')}  ${chalk.yellowBright(logSite.ssl_url)}`)
      if (logSite.repo_url) {
        log(`  ${chalk.whiteBright.bold('repo:')} ${chalk.white(logSite.repo_url)}`)
      }
      if (logSite.account_name) {
        log(`  ${chalk.whiteBright.bold('account:')} ${chalk.white(logSite.account_name)}`)
      }
      log(`─────────────────────────────────────────────────`)
    })
  }
}
