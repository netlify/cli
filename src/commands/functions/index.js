
const {Command, flags} = require('@oclif/command')
const AsciiTable = require('ascii-table')
const { execSync } = require('child_process')
const chalk = require('chalk')

class FunctionsCommand extends Command {
  async run() {
    const { flags, args } = this.parse(FunctionsCommand) // { args: {}, argv: [], flags: {}, raw: [] }
    // run help command if no args passed
    execSync(`./bin/run ${this.id} --help`, { stdio:[0,1,2] })
  }
}


const name = chalk.greenBright(`\`functions\``)

FunctionsCommand.description = `Manage netlify functions
The ${name} command will help you manage the functions in this site
`
FunctionsCommand.examples = [
  '$ netlify functions:create --name function-xyz --runtime nodejs',
  '$ netlify functions:update --name function-abc --timeout 30s',
]

module.exports = FunctionsCommand
