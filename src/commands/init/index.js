const Command = require('../../base')
const renderShortDesc = require('../../utils/renderShortDescription')

class InitCommand extends Command {
  async run() {

    await this.authenticate()

    return this.exit()
  }
}

InitCommand.description = `${renderShortDesc('Configure continuous deployment')}`

module.exports = InitCommand
