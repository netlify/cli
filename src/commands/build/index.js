const build = require('@netlify/build')
const { getConfigPath } = require('@netlify/config')
const { flags } = require('@oclif/command')
const Command = require('../../utils/command')

class BuildCommand extends Command {
  // Run Netlify Build
  async run() {
    /*
      @TODO remove this.getOptions() & use the parsed config from Command.
      this.netlify.config contains resolved config via @netlify/config
      @netlify/build currently takes a path to config and resolves config values again
    */
    const options = await this.getOptions()

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: { command: 'build', dry: options.dry }
    })

    const success = await build(options)
    const exitCode = success ? 0 : 1
    this.exit(exitCode)
  }

  // Retrieve Netlify Build options
  async getOptions() {
    const { site } = this.netlify
    const {
      flags: { dry = false, context }
    } = this.parse(BuildCommand)
    const [token] = this.getConfigToken()

    // Try current directory first, then site root
    const config = (await getConfigPath()) || (await getConfigPath(undefined, this.netlify.site.root))

    let options = {
      config,
      token,
      dry,
      context
    }
    if (site.id) {
      options.siteId = site.id
    }
    return options
  }
}

// Netlify Build programmatic options
BuildCommand.flags = {
  dry: flags.boolean({
    description: 'Dry run: show instructions without running them'
  }),
  context: flags.string({
    description: 'Build context'
  })
}

BuildCommand.description = `Beta - Netlify build`

BuildCommand.examples = ['netlify build']

BuildCommand.hidden = true

module.exports = BuildCommand
