const netlify = require('netlifys_api_definition')
const AsciiTable = require('ascii-table')
const { Command, flags } = require('@oclif/command')
const { CLIError } = require('@oclif/errors')

const accessToken = process.env.NETLIFY_ACCESS_TOKEN // to be replaced by
netlify.ApiClient.instance.authentications['netlifyAuth'].accessToken = accessToken;

const api = new netlify.DefaultApi()

class SitesListCommand extends Command {
  async run() {
    // const { flags } = this.parse(SitesListCommand)

    // Temp check
    if (!process.env.NETLIFY_ACCESS_TOKEN) {
      throw new CLIError(`Please set NETLIFY_ACCESS_TOKEN in session

Run the following command in your terminal:

export NETLIFY_ACCESS_TOKEN=YourTokenHere`)
    }

    // Fetch all sites!
    api.listSites(null, (err, sites) => {
      if (err) {
        throw new CLIError(err)
      }

      if (sites && sites.length) {
        const logSites = sites.map((site) => {
          return {
            id: site.id,
            name: site.name,
            ssl_url: site.ssl_url
          }
        })

        // Build a table out of sites
        const table = new AsciiTable('Netlify Sites')
        table.setHeading('Name', 'Url', 'id')

        logSites.forEach((s) => {
          table.addRow(s.name, s.ssl_url,  s.id)
        })

        // Log da sites
        console.log(table.toString())
      }
    })
  }
}

SitesListCommand.description = `list sites
...
Extra documentation goes here
`

module.exports = SitesListCommand
