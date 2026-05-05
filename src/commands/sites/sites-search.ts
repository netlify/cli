import { OptionValues } from 'commander'

import { listSites } from '../../lib/api.js'
import { startSpinner, stopSpinner } from '../../lib/spinner.js'
import { chalk, log, logJson } from '../../utils/command-helpers.js'
import BaseCommand from '../base-command.js'

export const sitesSearch = async (searchTerm: string, options: OptionValues, command: BaseCommand) => {
  const { api } = command.netlify

  await command.authenticate()

  let spinner
  if (!options.json) {
    spinner = startSpinner({ text: `Searching for projects matching '${searchTerm}'` })
  }

  const sites = await listSites({ api, options: { name: searchTerm, filter: 'all' } })

  if (spinner) {
    stopSpinner({ spinner })
  }

  if (sites.length === 0) {
    if (options.json) {
      logJson([])
      return
    }

    log()
    log(chalk.yellow(`No projects found matching '${searchTerm}'`))
    log()
    return
  }

  if (options.json) {
    const redactedSites = sites.map((site) => {
      if (site.build_settings?.env) {
        delete site.build_settings.env
      }
      return site
    })
    logJson(redactedSites)
    return
  }

  log()
  log(`Found ${chalk.greenBright(sites.length)} project${sites.length === 1 ? '' : 's'} matching '${searchTerm}':`)
  log()

  sites.forEach((site) => {
    log(`${chalk.greenBright(site.name)} - ${chalk.dim(site.id)}`)
    log(`  ${chalk.whiteBright.bold('url:')}  ${chalk.yellowBright(site.ssl_url)}`)
    if (site.build_settings?.repo_url) {
      log(`  ${chalk.whiteBright.bold('repo:')} ${chalk.white(site.build_settings.repo_url)}`)
    }
    if (site.account_name) {
      log(`  ${chalk.whiteBright.bold('account:')} ${chalk.white(site.account_name)}`)
    }
    log(`─────────────────────────────────────────────────`)
  })
}
