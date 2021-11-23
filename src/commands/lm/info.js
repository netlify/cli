const Listr = require('listr')

const Command = require('../../utils/command')
const {
  checkGitLFSVersionStep,
  checkGitVersionStep,
  checkHelperVersionStep,
  checkLFSFiltersStep,
} = require('../../utils/lm/steps')

class LmInfoCommand extends Command {
  async run() {
    this.parse(LmInfoCommand)
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

    const tasks = new Listr(steps, { concurrent: true, exitOnError: false })
    try {
      await tasks.run()
    } catch {
      // an error is already reported when a task fails
    }
  }
}

LmInfoCommand.description = `Show large media requirements information.`

module.exports = LmInfoCommand
