const { Command } = require('@oclif/command')
const renderShortDesc = require('../../utils/renderShortDescription')

class InitCommand extends Command {
  async run() {
    this.log(`Do init! https://github.com/netlify/netlify-cli/tree/master/lib/commands/init`)
    this.exit()
  }
}

InitCommand.description = `${renderShortDesc('Configure continuous deployment in current working directory')}`

InitCommand.examples = [
  '$ netlify init',
]

module.exports = InitCommand
