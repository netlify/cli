// @ts-check
import { listSites } from '../../lib/api.mjs'
import { startSpinner, stopSpinner } from '../../lib/spinner.mjs'
import { chalk, log, logJson } from '../../utils/command-helpers.mjs'

/**
 * The sites:list command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 * @returns {Promise<{ id: any; name: any; ssl_url: any; account_name: any; }|boolean>}
 */
const sitesList = async (options, command) => {
  const { api } = command.netlify
  /** @type {import('ora').Ora} */
  let spinner
  if (!options.json) {
    spinner = startSpinner({ text: 'Loading your sites' })
  }
  await command.authenticate()

  const sites = await listSites({ api, options: { filter: 'all' } })
  if (!options.json) {
    stopSpinner({ spinner })
  }

  if (sites && sites.length !== 0) {
    const logSites = sites.map((site) => {
      const siteInfo = {
        id: site.id,
        name: site.name,
        ssl_url: site.ssl_url,
        account_name: site.account_name,
      }

      if (site.build_settings && site.build_settings.repo_url) {
        siteInfo.repo_url = site.build_settings.repo_url
      }

      return siteInfo
    })

    // Json response for piping commands
    if (options.json) {
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

/**
 * Creates the `netlify sites:list` command
 * @param {import('../base-command.mjs').default} program
 */
export const createSitesListCommand = (program) =>
  program
    .command('sites:list')
    .description('List all sites you have access to')
    .option('--json', 'Output site data as JSON')
    .action(async (options, command) => {
      await sitesList(options, command)
    })
