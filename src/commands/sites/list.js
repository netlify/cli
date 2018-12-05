const { flags } = require('@oclif/command')
const chalk = require('chalk')
const { cli } = require('cli-ux')
const Command = require('../../base')

class SitesListCommand extends Command {
  async run() {
    const { flags } = this.parse(SitesListCommand)
    const { api } = this.netlify
    cli.action.start('Loading your sites')
    await this.authenticate()

    const sites = await api.listSites({ filter: 'all' })
    cli.action.stop()

    if (sites && sites.length) {
      const logSites = sites.map(site => {
        const siteInfo = {
          id: site.id,
          name: site.name,
          ssl_url: site.ssl_url,
          account_name: site.account_name
        }

        if (site.build_settings && site.build_settings.repo_url) {
          siteInfo.repo_url = site.build_settings.repo_url
        }

        return siteInfo
      })

      // Json response for piping commands
      if (flags.json) {
        const redactedSites = sites.map(site => {
          if (site && site.build_settings) {
            delete site.build_settings.env
          }
          return site
        })
        console.log(JSON.stringify(redactedSites, null, 2))
        return false
      }

      this.log(`
────────────────────────────┐
   Current Netlify Sites    │
────────────────────────────┘
`)

      logSites.forEach(s => {
        console.log(`${chalk.greenBright(s.name)} - ${s.id}`)
        console.log(`  ${chalk.whiteBright.bold('url:')}  ${chalk.yellowBright(s.ssl_url)}`)
        if (s.repo_url) {
          console.log(`  ${chalk.whiteBright.bold('repo:')} ${chalk.white(s.repo_url)}`)
        }
        if (s.account_name) {
          console.log(`  ${chalk.whiteBright.bold('account:')} ${chalk.white(s.account_name)}`)
        }
        console.log(`─────────────────────────────────────────────────`)
      })
    }
  }
}

SitesListCommand.description = `List all sites you have access to`

SitesListCommand.flags = {
  json: flags.boolean({
    description: 'Output site data as JSON'
  })
}

module.exports = SitesListCommand
