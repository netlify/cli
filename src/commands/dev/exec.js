const execa = require('execa')
const Command = require('../../utils/command')
const {
  // NETLIFYDEV,
  NETLIFYDEVLOG,
  // NETLIFYDEVWARN,
  NETLIFYDEVERR
} = require('../../utils/logo')

class ExecCommand extends Command {
  async run() {
    const { site, api } = this.netlify
    if (site.id) {
      this.log(`${NETLIFYDEVLOG} Checking your site's environment variables...`) // just to show some visual response first
      const accessToken = api.accessToken
      const { addEnvVariables } = require('../../utils/dev')
      await addEnvVariables(api, site, accessToken)
    } else {
      this.log(
        `${NETLIFYDEVERR} No Site ID detected. You probably forgot to run \`netlify link\` or \`netlify init\`. `
      )
    }
    execa(this.argv[0], this.argv.slice(1), {
      env: process.env,
      stdio: 'inherit'
    })
    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'dev:exec'
      }
    })
  }
}

ExecCommand.description = `Exec command
Runs a command within the netlify dev environment, e.g. with env variables from any installed addons
`

ExecCommand.examples = ['$ netlify exec npm run bootstrap']

ExecCommand.strict = false
ExecCommand.parse = false

module.exports = ExecCommand
