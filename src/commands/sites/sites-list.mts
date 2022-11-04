// @ts-check

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'listSites'... Remove this comment to see the full error message
const { listSites } = require('../../lib/api.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'startSpinn... Remove this comment to see the full error message
const { startSpinner, stopSpinner } = require('../../lib/spinner.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'chalk'.
const { chalk, log, logJson } = require('../../utils/index.mjs')

/**
 * The sites:list command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns {Promise<{ id: any; name: any; ssl_url: any; account_name: any; }|boolean>}
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const sitesList = async (options: $TSFixMe, command: $TSFixMe) => {
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
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    const logSites = sites.map((site: $TSFixMe) => {
      const siteInfo = {
        id: site.id,
        name: site.name,
        ssl_url: site.ssl_url,
        account_name: site.account_name,
      }

      if (site.build_settings && site.build_settings.repo_url) {
        // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
        (siteInfo as $TSFixMe).repo_url = site.build_settings.repo_url;
      }

      return siteInfo
    })

    // Json response for piping commands
    if (options.json) {
      // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
      const redactedSites = sites.map((site: $TSFixMe) => {
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

    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    logSites.forEach((logSite: $TSFixMe) => {
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
 * @param {import('../base-command').BaseCommand} program
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createSite... Remove this comment to see the full error message
const createSitesListCommand = (program: $TSFixMe) => program
  .command('sites:list')
  .description('List all sites you have access to')
  .option('--json', 'Output site data as JSON')
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  .action(async (options: $TSFixMe, command: $TSFixMe) => {
    await sitesList(options, command)
  })

module.exports = { createSitesListCommand }
