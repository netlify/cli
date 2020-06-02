const build = require('@netlify/build')
const { flags } = require('@oclif/command')
const Command = require('../../utils/command')

class BuildCommand extends Command {
  // Run Netlify Build
  async run() {
    const options = this.getOptions()
    this.checkOptions(options)

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: { command: 'build', dry: Boolean(options.dry) },
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
      flags: { dry },
    } = this.parse(BuildCommand)
    const [token] = this.getConfigToken()
    return { cachedConfig, token, dry, mode: 'cli' }
  }

  checkOptions({ cachedConfig, token }) {
    const { siteInfo = {} } = JSON.parse(cachedConfig)
    if (!siteInfo.id && process.env.NODE_ENV !== 'test') {
      console.error('Could not find the site ID. Please run netlify link.')
      this.exit(1)
    }

    if (!token) {
      console.error('Could not find the access token. Please run netlify login.')
      this.exit(1)
    }
  }
}

// Netlify Build programmatic options
BuildCommand.flags = {
  dry: flags.boolean({
    description: 'Dry run: show instructions without running them',
  }),
  context: flags.string({
    description: 'Build context',
  }),
}

BuildCommand.description = `(Beta) Build on your local machine`

BuildCommand.examples = ['netlify build']

module.exports = BuildCommand
