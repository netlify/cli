const { Command, flags } = require('@oclif/command')
// const parseRawFlags = require('../../utils/parseRawFlags')

class SitesDeleteCommand extends Command {
  async run() {
    const { args } = this.parse(SitesDeleteCommand)

    this.log(`delete a site id:`, args.siteID)
    this.log(`Implementation coming soon`)

    // 1. Prompt user for verification

    // const {force, f} = parseRawFlags(raw)
    // if (!force || !f) {
    //   const inquirer = require('inquirer')
    //   const {wantsToDelete} = await inquirer.prompt({
    //     type: 'confirm',
    //     name: 'wantsToDelete',
    //     message: `Are you sure you want to delete the ${addonName} add-on? (to skip this prompt, pass a --force flag)`,
    //     default: false
    //   })
    //   if (!wantsToDelete) this.exit()
    // }

    // 2. delete site

    // 3. --force flag to skip prompts
  }
}

SitesDeleteCommand.description = `delete a site`

SitesDeleteCommand.args = [
  {
    name: 'siteID',
    required: true,
    description: 'Site ID to delete'
  }
]
SitesDeleteCommand.flags = {
  force: flags.boolean({ char: 'f', description: 'delete without prompting (useful for CI)' })
}

SitesDeleteCommand.examples = ['netlify site:delete 123-432621211']

// TODO implement logic
SitesDeleteCommand.hidden = true

module.exports = SitesDeleteCommand
