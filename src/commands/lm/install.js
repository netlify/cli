const { flags: flagsLib } = require('@oclif/command')

const Command = require('../../utils/command')
const { installPlatform } = require('../../utils/lm/install')
const { printBanner } = require('../../utils/lm/ui')

class LmInstallCommand extends Command {
  async run() {
    const { flags } = this.parse(LmInstallCommand)

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'lm:install',
      },
    })

    try {
      const installed = await installPlatform(flags.force)
      if (installed) {
        printBanner(this, flags.force)
      }
    } catch (error) {
      this.log(error)
    }
  }
}

LmInstallCommand.aliases = ['lm:init']
LmInstallCommand.flags = {
  force: flagsLib.boolean({
    char: 'f',
    description: 'Force the credentials helper installation',
  }),
}

LmInstallCommand.description = `Configures your computer to use Netlify Large Media.
It installs the required credentials helper for Git,
and configures your Git environment with the right credentials.`
LmInstallCommand.hidden = true

LmInstallCommand.examples = ['netlify lm:install']

module.exports = LmInstallCommand
