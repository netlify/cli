const AsciiTable = require('ascii-table')
const { flags } = require('@oclif/command')
const Command = require('../../base')
const renderShortDesc = require('../../utils/renderShortDescription')

class SitesListCommand extends Command {
  async run() {
    const { flags } = this.parse(SitesListCommand)
    await this.authenticate()

    const sites = await this.netlify.listSites()

    if (sites && sites.length) {
      const logSites = sites.map(site => {
        return {
          id: site.id,
          name: site.name,
          ssl_url: site.ssl_url
        }
      })

      // Json response for piping commands
      if (flags.json) {
        const redactedSites = sites.map(site => {
          delete site.build_settings
          return site
        })
        console.log(JSON.stringify(redactedSites, null, 2))
        return false
      }

      // Build a table out of sites
      const table = new AsciiTable('Netlify Sites')

      table.setHeading('Name', 'Url', 'id')

      logSites.forEach(s => {
        table.addRow(s.name, s.ssl_url, s.id)
      })
      // Log da sites
      console.log(table.toString())
    }
  }
}

SitesListCommand.description = `${renderShortDesc('List all sites you have access too')}`

SitesListCommand.flags = {
  json: flags.boolean({
    description: 'Output site data as JSON'
  })
}

module.exports = SitesListCommand
