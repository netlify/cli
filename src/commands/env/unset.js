const Command = require('../../utils/command')

class EnvUnsetCommand extends Command {
  async run() {
    const { args, flags } = this.parse(EnvUnsetCommand)
    const { api, site } = this.netlify
    const siteId = site.id
    const { name } = args

    if (!siteId) {
      this.log('No site id found, please run inside a site folder or `netlify link`')
      return false
    }

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'env:unset',
      },
    })

    const siteData = await api.getSite({ siteId })

    // Get current environment variables set in the UI
    const {
      build_settings: { env = {} },
    } = siteData

    const newEnv = env

    // Delete environment variable from current variables
    delete newEnv[args.name]

    // Apply environment variable updates
    const siteResult = await api.updateSite({
      siteId,
      body: {
        build_settings: {
          env: newEnv,
        },
      },
    })

    // Return new environment variables of site if using json flag
    if (flags.json) {
      this.logJson(siteResult.build_settings.env)
      return false
    }

    this.log(`Unset environment variable ${name} for site ${siteData.name}`)
  }
}

EnvUnsetCommand.description = `Unset an environment variable which removes it from the UI`
EnvUnsetCommand.aliases = ['env:delete', 'env:remove']
EnvUnsetCommand.args = [
  {
    name: 'name',
    required: true,
    description: 'Environment variable name',
  },
]

module.exports = EnvUnsetCommand
