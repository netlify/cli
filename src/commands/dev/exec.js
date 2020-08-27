const path = require('path')
const execa = require('execa')
const chalk = require('chalk')
const Command = require('../../utils/command')
const {
  // NETLIFYDEV,
  NETLIFYDEVLOG,
  // NETLIFYDEVWARN,
  NETLIFYDEVERR,
} = require('../../utils/logo')
const { getEnvSettings } = require('../../utils/env')

class ExecCommand extends Command {
  async run() {
    const { site, api } = this.netlify
    if (site.id) {
      this.log(`${NETLIFYDEVLOG} Checking your site's environment variables...`) // just to show some visual response first
      const { addEnvVariables } = require('../../utils/dev')
      await addEnvVariables(api, site)
    } else {
      this.log(
        `${NETLIFYDEVERR} No Site ID detected. You probably forgot to run \`netlify link\` or \`netlify init\`. `
      )
    }

    const envSettings = await getEnvSettings(site.root)
    if (envSettings.file) {
      console.log(
        `${NETLIFYDEVLOG} Overriding the following env variables with ${chalk.blue(
          path.relative(site.root, envSettings.file)
        )} file:`,
        chalk.yellow(Object.keys(envSettings.vars))
      )
      Object.entries(envSettings.vars).forEach(([key, val]) => (process.env[key] = val))
    }

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
