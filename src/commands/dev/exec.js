const execa = require('execa')

const Command = require('../../utils/command')
const { getSiteInformation, addEnvVariables } = require('../../utils/dev')

class ExecCommand extends Command {
  async run() {
    const { log, warn, error, netlify } = this
    const { site, api, siteInfo } = netlify
    const { teamEnv, addonsEnv, siteEnv, dotFilesEnv } = await getSiteInformation({
      api,
      site,
      warn,
      error,
      siteInfo,
    })
    await addEnvVariables({ log, teamEnv, addonsEnv, siteEnv, dotFilesEnv })

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
