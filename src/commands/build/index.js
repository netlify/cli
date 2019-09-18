const Command = require('@netlify/cli-utils')
const chalk = require('chalk')
const netlifyBuild = require('@netlify/build')
const { parseRawFlags } = require('../../utils/parse-raw-flags')
const { flags } = require('@oclif/command')
const { getNelifyConfigFile } = require('@netlify/build')

class BuildCommand extends Command {
  async run() {
    const { raw } = this.parse(BuildCommand)
    const { site } = this.netlify
    // GET flags from `raw` data
    const rawFlags = parseRawFlags(raw)
    let configPath
    try {
      configPath = await getNelifyConfigFile(site.root)
    } catch (err) {
      console.log(`No Netlify Config file found in ${site.root}`)
      this.exit()
    }

    try {
      await netlifyBuild(configPath, rawFlags)
    } catch (err) {
      console.log()
      console.log(chalk.redBright.bold('┌────────────────────────┐'))
      console.log(chalk.redBright.bold('│  Netlify Build Error!  │'))
      console.log(chalk.redBright.bold('└────────────────────────┘'))
      console.log(chalk.bold(` ${err.message}`))
      console.log()
      console.log(chalk.redBright.bold('┌────────────────────────┐'))
      console.log(chalk.redBright.bold('│      Stack Trace:      │'))
      console.log(chalk.redBright.bold('└────────────────────────┘'))
      console.log(` ${chalk.bold(err.stack)}`)
      console.log()
      this.exit()
    }

    const sparkles = chalk.cyanBright('(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧')
    console.log(`\n${sparkles} Finished with the build process!\n`)
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
  plan: flags.boolean({
    description: 'Dry run of build'
  })
}

BuildCommand.description = `Alpha - Netlify build`

BuildCommand.examples = ['netlify build']

BuildCommand.strict = false

BuildCommand.hidden = true

module.exports = BuildCommand
