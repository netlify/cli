const Command = require('../../utils/command')
const { uninstall } = require('../../utils/lm/install')

class LmUninstallCommand extends Command {
  async run() {
    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'lm:uninstall',
      },
    })

    await uninstall()
  }
}

LmUninstallCommand.aliases = ['lm:remove']
LmUninstallCommand.hidden = true

LmUninstallCommand.description =
  'Uninstalls Netlify git credentials helper and cleans up any related configuration changes made by the install command.'

module.exports = LmUninstallCommand
