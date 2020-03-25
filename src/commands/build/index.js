const build = require('@netlify/build')
const { flags } = require('@oclif/command')
const Command = require('../../utils/command')

class BuildCommand extends Command {
  // Run Netlify Build
  async run() {
    const options = this.getOptions()

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: { command: 'build', dry: options.dry }
    })

    const success = await build(options)
    const exitCode = success ? 0 : 1
    this.exit(exitCode)
  }

  // Retrieve Netlify Build options
  getOptions() {
    const {
      site: { id: siteId },
      cachedConfig
    } = this.netlify
    // We have already resolved the configuration using `@netlify/config`
    // This is stored as `this.netlify.cachedConfig` and can be passed to
    // `@netlify/build --cachedConfig`.
    const cachedConfigOption = JSON.stringify(cachedConfig)
    const {
      flags: { dry = false }
    } = this.parse(BuildCommand)
    const [token] = this.getConfigToken()
    return { cachedConfig: cachedConfigOption, token, dry, siteId }
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
