const AsciiTable = require('ascii-table')
const Command = require('../../../base')

class SitesListCommand extends Command {
  async run() {
    // const { flags } = this.parse(SitesListCommand)
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

SitesListCommand.description = `list sites
...
Extra documentation goes here
`

module.exports = SitesListCommand
