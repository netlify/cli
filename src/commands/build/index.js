const build = require('@netlify/build')
const { flags } = require('@oclif/command')
const Command = require('../../utils/command')

class BuildCommand extends Command {
  // Run Netlify Build
  async run() {
    const options = this.getOptions()

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: { command: 'build', dry: Boolean(options.dry) }
    })

    const success = await build(options)
    const exitCode = success ? 0 : 1
    this.exit(exitCode)
  }

  // Retrieve Netlify Build options
  getOptions() {
    // We have already resolved the configuration using `@netlify/config`
    // This is stored as `this.netlify.cachedConfig` and can be passed to
    // `@netlify/build --cachedConfig`.
    const cachedConfig = JSON.stringify(this.netlify.cachedConfig)
    const {
      flags: { dry }
    } = this.parse(BuildCommand)
    const [token] = this.getConfigToken()
    return { cachedConfig, token, dry }
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

BuildCommand.description = `(Beta) Build on your local machine`

BuildCommand.examples = ['netlify build']

module.exports = BuildCommand
