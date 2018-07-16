const { Command } = require('@oclif/command')
const renderShortDesc = require('../../utils/renderShortDescription')

class InitCommand extends Command {
  async run() {
    await this.config.runHook('login')
  }
}

InitCommand.description = `${renderShortDesc('Configure continuous deployment in current working directory')}`

InitCommand.examples = ['$ netlify init']

module.exports = InitCommand
