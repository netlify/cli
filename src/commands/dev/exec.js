const fromEntries = require('@ungap/from-entries')
const chalk = require('chalk')
const execa = require('execa')

const Command = require('../../utils/command')
const { getEnvSettings } = require('../../utils/env')
const {
  // NETLIFYDEV,
  NETLIFYDEVLOG,
  // NETLIFYDEVWARN,
  NETLIFYDEVERR,
} = require('../../utils/logo')

class ExecCommand extends Command {
  async run() {
    const { site, api } = this.netlify
    if (site.id) {
      // just to show some visual response first
      this.log(`${NETLIFYDEVLOG} Checking your site's environment variables...`)
      const { addEnvVariables } = require('../../utils/dev')
      await addEnvVariables(api, site)
    } else {
      this.log(
        `${NETLIFYDEVERR} No Site ID detected. You probably forgot to run \`netlify link\` or \`netlify init\`. `,
      )
    }

    const envSettings = await getEnvSettings({ projectDir: site.root, warn: this.warn })
    if (envSettings.vars.length !== 0) {
      this.log(
        `${NETLIFYDEVLOG} Adding the following env variables from ${envSettings.files.map((file) =>
          chalk.blue(file),
        )}:`,
        chalk.yellow(envSettings.vars.map(([key]) => key)),
      )
    }

    execa(this.argv[0], this.argv.slice(1), {
      stdio: 'inherit',
      env: fromEntries(envSettings.vars),
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
