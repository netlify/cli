const { Command, flags } = require('@oclif/command')

class SitesDeleteCommand extends Command {
  async run() {
    const { args } = this.parse(SitesDeleteCommand)

    this.log(`delete a site id:`, args.siteID)
  }
}

SitesDeleteCommand.description = `delete a site`

SitesDeleteCommand.flags = {
  name: flags.string({
    char: 'n',
    description: 'name to print'
  })
}

SitesDeleteCommand.args = [{
  name: 'siteID',
  required: true,
  description: 'Site ID to delete'
}]

SitesDeleteCommand.examples = ['$ netlify site:delete 123-432621211']

// TODO implement logic
SitesDeleteCommand.hidden = true

module.exports = SitesDeleteCommand
