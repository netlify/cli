const process = require('process')

const { flags } = require('@oclif/command')

const { getBuildOptions, runBuild } = require('../../lib/build')
const Command = require('../../utils/command')

class BuildCommand extends Command {
  // Run Netlify Build
  async run() {
    // Retrieve Netlify Build options
    const options = await getBuildOptions({
      context: this,
      token: this.getConfigToken()[0],
      flags: this.parse(BuildCommand).flags,
    })
    this.checkOptions(options)

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: { command: 'build', dry: Boolean(options.dry) },
    })

    const exitCode = await runBuild(options)
    this.exit(exitCode)
  }

  checkOptions({ cachedConfig, token }) {
    const { siteInfo = {} } = JSON.parse(cachedConfig)
    if (!siteInfo.id && process.env.NODE_ENV !== 'test') {
      this.error('Could not find the site ID. Please run netlify link.', { exit: 1 })
    }

    if (!token) {
      this.error('Could not find the access token. Please run netlify login.', { exit: 1 })
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
  ...BuildCommand.flags,
}

BuildCommand.description = `(Beta) Build on your local machine`

BuildCommand.examples = ['netlify build']

module.exports = BuildCommand
