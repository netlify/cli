const Command = require('@netlify/cli-utils')
const chalk = require('chalk')
const netlifyBuild = require('@netlify/build')
const { parseRawFlags } = require('../../utils/parse-raw-flags')
const { flags } = require('@oclif/command')
const { getConfigPath } = require('@netlify/build')

class BuildCommand extends Command {
  async run() {
    const { raw } = this.parse(BuildCommand)
    const { site } = this.netlify
    // GET flags from `raw` data
    const rawFlags = parseRawFlags(raw)
    const cwd = process.cwd()
    const [ token ] = this.getConfigToken()

    let configPath
    try {
      // First try CWD
      configPath = await getConfigPath(cwd)
    } catch (err) {
      try {
        // Then try site root when top level git folder lives
        configPath = await getConfigPath(site.root)
      } catch (error) {} // eslint-disable-line
      const location = (site.root === process.cwd()) ? site.root : `${site.root} OR ${cwd}`
      console.log(`No Netlify Config file found in ${location}`)
      this.exit()
    }

    try {
      await netlifyBuild({
        config: configPath,
        token: token,
        dry: rawFlags.dry,
        verbose: rawFlags.verbose,
      })
    } catch (err) {
      this.exit()
    }
    /*
    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'build'
      }
    })
    */
  }
}

/* duplicate functionality from @netlify/build */
BuildCommand.flags = {
  dry: flags.boolean({
    description: 'Dry run of build'
  })
}

BuildCommand.description = `Alpha - Netlify build`

BuildCommand.examples = ['netlify build']

BuildCommand.strict = false

BuildCommand.hidden = true

module.exports = BuildCommand
