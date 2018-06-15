
const { Command, flags } = require('@oclif/command')
const AsciiTable = require('ascii-table')

class SitesListCommand extends Command {
  async run() {
    const {flags} = this.parse(SitesListCommand)
    const name = flags.name || 'world'
    // this.log(`list sites`)
    var table = new AsciiTable('Netlify Sites')
    table.setHeading('Name', 'Url', 'id')
    .addRow('my-site-xyz.netlify.com', 'my-custom-url.biz', '124123-ddhshs1212-1211')
    .addRow('wowza.netlify.com', 'serious.biz', 'x3123-22345-1211')
    .addRow('new-cli-docs.netlify.com', 'cli.netlify.com', 'weyhfd-hjjk-67533')

    console.log(table.toString())
  }
}

SitesListCommand.description = `list sites
...
Extra documentation goes here
`

SitesListCommand.flags = {
  name: flags.string({char: 'n', description: 'name to print'}),
}

module.exports = SitesListCommand
