const { Command } = require('@oclif/command')
const { execSync } = require('child_process')
const chalk = require('chalk')
const renderShortDesc = require('../../utils/renderShortDescription')

class FunctionsCommand extends Command {
  async run() {
    // run help command if no args passed
    execSync(`./bin/run ${this.id} --help`, { stdio: [0, 1, 2] })
  }
}

const name = chalk.greenBright(`\`functions\``)

FunctionsCommand.description = `${renderShortDesc('Manage netlify functions')}
The ${name} command will help you manage the functions in this site
`
FunctionsCommand.examples = [
  '$ netlify functions:create --name function-xyz --runtime nodejs',
  '$ netlify functions:update --name function-abc --timeout 30s'
]

module.exports = FunctionsCommand
