const { Command } = require('@oclif/command')
const chalk = require('chalk')
const Listr = require('listr')

const { GitValidators, checkLFSFilters, checkHelperVersion } = require('../../utils/lm/requirements')

class LmInfoCommand extends Command {
  async run() {
    const steps = [
      ...GitValidators,
      {
        title: 'Checking Git LFS filters',
        task: async () => {
          const installed = await checkLFSFilters()
          if (!installed) {
            throw new Error('Git LFS filters are not installed, run `git lfs install` to install them')
          }
        },
      },
      {
        title: `Checking Netlify's Git Credentials version`,
        task: async (ctx, task) => {
          const version = await checkHelperVersion()
          task.title += chalk.dim(` [${version}]`)
        },
      },
    ]

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'lm:info',
      },
    })

    const tasks = new Listr(steps, { concurrent: true, exitOnError: false })
    tasks.run().catch(() => {})
  }
}

LmInfoCommand.description = `Show large media requirements info.`
LmInfoCommand.hidden = true

LmInfoCommand.examples = ['netlify lm:info']

module.exports = LmInfoCommand
