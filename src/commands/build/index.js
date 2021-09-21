const { flags: flagsLib } = require('@oclif/command')

const { getBuildOptions, runBuild } = require('../../lib/build')
const Command = require('../../utils/command')
const { error, exit, getToken } = require('../../utils/command-helpers')

const checkOptions = ({ cachedConfig: { siteInfo = {} }, token }) => {
  if (!siteInfo.id) {
    error('Could not find the site ID. Please run netlify link.', { exit: 1 })
  }

  if (!token) {
    error('Could not find the access token. Please run netlify login.', { exit: 1 })
  }
}

class BuildCommand extends Command {
  // Run Netlify Build
  async run() {
    const { flags } = this.parse(BuildCommand)

    this.setAnalyticsPayload({ dry: flags.dry })

    // Retrieve Netlify Build options
    const [token] = await getToken()

    const options = await getBuildOptions({
      context: this,
      token,
      flags,
    })

    if (!flags.offline) {
      checkOptions(options)
    }

    const { exitCode } = await runBuild(options)
    exit(exitCode)
  }
}

// Netlify Build programmatic options
BuildCommand.flags = {
  dry: flagsLib.boolean({
    description: 'Dry run: show instructions without running them',
    default: false,
  }),
  context: flagsLib.string({
    description: 'Build context',
  }),
  offline: flagsLib.boolean({
    char: 'o',
    description: 'disables any features that require network access',
    default: false,
  }),
  ...BuildCommand.flags,
}

BuildCommand.description = `(Beta) Build on your local machine`

BuildCommand.examples = ['netlify build']

module.exports = BuildCommand
