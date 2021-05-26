const Listr = require('listr')

const Command = require('../../utils/command')
const {
  checkGitVersionStep,
  checkGitLFSVersionStep,
  checkLFSFiltersStep,
  checkHelperVersionStep,
} = require('../../utils/lm/steps')
const { track } = require('../../utils/telemetry')

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

    await track('command', {
      command: 'lm:info',
    })

    const tasks = new Listr(steps, { concurrent: true, exitOnError: false })
    try {
      await tasks.run()
    } catch (_) {
      // an error is already reported when a task fails
    }
  }
}

LmInfoCommand.description = `Show large media requirements information.`

module.exports = LmInfoCommand
