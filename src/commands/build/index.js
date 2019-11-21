const build = require('@netlify/build')
const { getConfigPath } = require('@netlify/config')
const { flags } = require('@oclif/command')
const Command = require('../../utils/command')
const { parseRawFlags } = require('../../utils/parse-raw-flags')

class BuildCommand extends Command {
  // Run Netlify Build
  async run() {
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
    const { raw } = this.parse(BuildCommand)
    const { dry = false } = parseRawFlags(raw)
    const [token] = this.getConfigToken()

    // Try current directory first, then site root
    const config = (await getConfigPath()) || (await getConfigPath(undefined, this.netlify.site.root))

    return { config, token, dry }
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

BuildCommand.strict = false

BuildCommand.hidden = true

module.exports = BuildCommand
