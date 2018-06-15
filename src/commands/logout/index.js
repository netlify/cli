const { Command } = require('@oclif/command')

class LogoutCommand extends Command {
  async run() {
    const { flags, args} = this.parse(LogoutCommand)
    this.log(`Logging you out of Netlify. Come back soon`)
  }
}

LogoutCommand.description = `Logout of account`

module.exports = LogoutCommand
