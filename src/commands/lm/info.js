const Listr = require('listr')

const Command = require('../../utils/command')
const {
  checkGitVersionStep,
  checkGitLFSVersionStep,
  checkLFSFiltersStep,
  checkHelperVersionStep,
} = require('../../utils/lm/steps')

class LmInfoCommand extends Command {
  async run() {
    const steps = [
      checkGitVersionStep,
      checkGitLFSVersionStep,
      checkLFSFiltersStep((ctx, task, installed) => {
        if (!installed) {
          throw new Error('Git LFS filters are not installed, run `git lfs install` to install them')
        }
      }),
      checkHelperVersionStep,
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
