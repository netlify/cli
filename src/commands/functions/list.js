const { Command, flags } = require('@oclif/command')
const AsciiTable = require('ascii-table')

class FunctionsListCommand extends Command {
  async run() {
    var table = new AsciiTable('Netlify Functions')
    table
      .setHeading('Name', 'Url', 'Type', 'id')
      .addRow('function-abc', 'site.com/.netlify/function-abc', 'http GET', '124123-ddhshs1212-1211')
      .addRow('send-email-function', 'site.com/.netlify/send-email-function', 'http POST', 'x3123-22345-1211')
      .addRow('lol-function-cool', 'site.com/.netlify/lol-function-cool', 'scheduled', 'weyhfd-hjjk-67533')

    console.log(table.toString())
  }
}

FunctionsListCommand.description = `list sites
...
Extra documentation goes here
`

FunctionsListCommand.flags = {
  name: flags.string({ char: 'n', description: 'name to print' })
}

// TODO make visible once implementation complete
FunctionsListCommand.hidden = true

module.exports = FunctionsListCommand
