const { Command } = require('@oclif/command')

class SitesDeleteCommand extends Command {
  async run() {
    const { args } = this.parse(SitesDeleteCommand)

    this.log(`delete a site id:`, args.siteID)
    this.log(`Implementation coming soon`)

    // 1. Prompt user for verification

    // 2. delete site

    // 3. --force flag to skip prompts
  }
}

SitesDeleteCommand.description = `delete a site`

SitesDeleteCommand.args = [{
  name: 'siteID',
  required: true,
  description: 'Site ID to delete'
}]

SitesDeleteCommand.examples = ['netlify site:delete 123-432621211']

// TODO implement logic
SitesDeleteCommand.hidden = true

module.exports = SitesDeleteCommand
