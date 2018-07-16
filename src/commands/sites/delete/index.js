const { Command, flags } = require('@oclif/command')

class SitesDeleteCommand extends Command {
  async run() {
    const { args } = this.parse(SitesDeleteCommand) // { args: {}, argv: [], flags: {}, raw: [] }
    //if (process.argv[3]) {
    this.log(`delete a site id:`, args.siteID)
    //}
  }
}

SitesDeleteCommand.description = `delete a site
...
Extra documentation goes here
`

SitesDeleteCommand.flags = {
  name: flags.string({ char: 'n', description: 'name to print' })
}

SitesDeleteCommand.args = [
  {
    name: 'siteID', // name of arg to show in help and reference with args[name]
    required: true, // make the arg required with `required: true`
    description: 'Site ID to delete' // help description
    // hidden: true,                  // hide this arg from help
    // parse: input => 'output',      // instead of the user input, return a different value
    // default: 'world',              // default value if no arg input
    // options: ['a', 'b'],           // only allow input to be from a discrete set
  }
]

SitesDeleteCommand.examples = ['$ netlify site:delete 123-432621211']

module.exports = SitesDeleteCommand
