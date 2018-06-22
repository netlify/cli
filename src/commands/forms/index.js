const { Command, flags } = require('@oclif/command')
const { execSync } = require('child_process')
const chalk = require('chalk')
const renderShortDesc = require('../../utils/renderShortDescription')

class FormsCommand extends Command {
  async run() {
    const { flags, args } = this.parse(FormsCommand) // { args: {}, argv: [], flags: {}, raw: [] }

    // Show help on empty sub command
    if (emptyCommand(flags, args)) {
      // run help command if no args passed
      execSync(`./bin/run ${this.id} --help`, {stdio:[0,1,2]});
    }
  }
}

function emptyCommand(flags, args) {
  const hasFlags = Object.keys(flags).length
  const hasArgs = Object.keys(args).length
  if (!hasFlags && !hasArgs) {
    return true
  }
  return false
}

FormsCommand.description = `${renderShortDesc('Handle form operations')}
The sites command will help you manage all your netlify forms
`

FormsCommand.examples = [
  '$ netlify forms:list'
]

module.exports = FormsCommand
