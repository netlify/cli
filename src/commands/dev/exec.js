const execa = require('execa')

const Command = require('../../utils/command')
const { injectEnvVariables } = require('../../utils/dev')

class ExecCommand extends Command {
  async init() {
    this.commandContext = 'dev'
    await super.init()
  }

  async run() {
    const { log, warn, netlify } = this
    const { cachedConfig, site } = netlify
    await injectEnvVariables({ env: cachedConfig.env, log, site, warn })

    execa(this.argv[0], this.argv.slice(1), {
      stdio: 'inherit',
    })
    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'dev:exec',
      },
    })
  }
}

ExecCommand.description = `Exec command
Runs a command within the netlify dev environment, e.g. with env variables from any installed addons
`

ExecCommand.examples = ['$ netlify dev:exec npm run bootstrap']

ExecCommand.strict = false
ExecCommand.parse = false

module.exports = ExecCommand
