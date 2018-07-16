const { Command } = require('@oclif/command')
const AsciiTable = require('ascii-table')

class SitesListCommand extends Command {
  async run() {
    const table = new AsciiTable('Netlify Forms')
    table
      .setHeading('Site', 'Form Name', 'Url', 'id')
      .addRow('my-site-xyz.netlify.com', 'form-abc', 'app.netlify.com/site/forms/blah', '124123-ddhshs1212-1211')
      .addRow('wowza.netlify.com', 'form-123', 'app.netlify.com/site/forms/foo', 'x3123-22345-1211')
      .addRow('new-cli-docs.netlify.com', 'form-xyz', 'app.netlify.com/site/forms/baz', 'weyhfd-hjjk-67533')

    console.log(table.toString())
  }
}

SitesListCommand.description = `list sites
...
Extra documentation goes here
`

module.exports = SitesListCommand
