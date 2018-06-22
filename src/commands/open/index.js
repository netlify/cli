const { Command } = require('@oclif/command')
const openBrowser = require('../../utils/open-browser')
const renderShortDesc = require('../../utils/renderShortDescription')

class OpenCommand extends Command {
  async run() {
    this.log(`Opening {SITE XYZ} admin in your default browser`)
    openBrowser('https://app.netlify.com/sites/faunadb-example/overview')
    this.exit()
  }
}

OpenCommand.description = `${renderShortDesc('Opens current site admin UI in netlify')}`

OpenCommand.examples = [
  '$ netlify open',
]

OpenCommand.hidden = true

module.exports = OpenCommand
