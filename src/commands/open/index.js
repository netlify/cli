const { flags: flagsLib } = require('@oclif/command')

const { isEmptyCommand } = require('../../utils/check-command-inputs')
const Command = require('../../utils/command')
const showHelp = require('../../utils/show-help')

const OpenAdminCommand = require('./admin')
const OpenSiteCommand = require('./site')

class OpenCommand extends Command {
  async run() {
    const { flags, args } = this.parse(OpenCommand)
    // Show help on empty sub command
    if (isEmptyCommand(flags, args)) {
      showHelp(this.id)
    }

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'open',
      },
    })

    if (flags.site) {
      await OpenSiteCommand.run()
    }
    // Default open netlify admin
    await OpenAdminCommand.run()
  }
}

OpenCommand.flags = {
  ...OpenCommand.flags,
  site: flagsLib.boolean({
    description: 'Open site',
  }),
  admin: flagsLib.boolean({
    description: 'Open Netlify site',
  }),
}

OpenCommand.description = `Open settings for the site linked to the current folder`

OpenCommand.examples = ['netlify open --site', 'netlify open --admin', 'netlify open:admin', 'netlify open:site']

module.exports = OpenCommand
