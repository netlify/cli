const { Command, flags } = require('@oclif/command')
const AsciiTable = require('ascii-table')
const { execSync } = require('child_process')
const chalk = require('chalk')

class SitesCommand extends Command {
  async run() {
    const { flags, args } = this.parse(SitesCommand) // { args: {}, argv: [], flags: {}, raw: [] }

    // Show help on empty sub command
    if (emptyCommand(flags, args)) {
      console.log('show help')
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

SitesCommand.description = `Handle site operations
The sites command will help you manage all your sites
`

SitesCommand.examples = [
  '$ netlify sites:create -name my-new-site',
  '$ netlify sites:update -name my-new-site',
]

module.exports = SitesCommand
