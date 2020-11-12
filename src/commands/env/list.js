const AsciiTable = require('ascii-table')
const isEmpty = require('lodash/isEmpty')

const Command = require('../../utils/command')

class EnvListCommand extends Command {
  async run() {
    const { flags } = this.parse(EnvListCommand)
    const { api, site, config } = this.netlify
    const siteId = site.id

    if (!siteId) {
      this.log('No site id found, please run inside a site folder or `netlify link`')
      return false
    }

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'env:list',
      },
    })

    const siteData = await api.getSite({ siteId })
    const {
      build: { environment = {} },
    } = config

    // Return json response for piping commands
    if (flags.json) {
      this.logJson(environment)
      return false
    }

    if (isEmpty(environment)) {
      this.log(`No environment variables set for site ${siteData.name}`)
      return false
    }

    // List environment variables using a table
    this.log(`site: ${siteData.name}`)
    const table = new AsciiTable(`Environment variables`)

    table.setHeading('Key', 'Value')
    for (const [key, value] of Object.entries(environment)) {
      table.addRow(key, value)
    }
    this.log(table.toString())
  }
}

EnvListCommand.description = `Lists resolved environment variables for site (includes netlify.toml)`

module.exports = EnvListCommand
