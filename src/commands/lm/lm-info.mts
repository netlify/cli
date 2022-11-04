// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'Listr'.
const Listr = require('listr')

const {
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'checkGitLF... Remove this comment to see the full error message
  checkGitLFSVersionStep,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'checkGitVe... Remove this comment to see the full error message
  checkGitVersionStep,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'checkHelpe... Remove this comment to see the full error message
  checkHelperVersionStep,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'checkLFSFi... Remove this comment to see the full error message
  checkLFSFiltersStep,
} = require('../../utils/lm/steps.cjs')

/**
 * The lm:info command
 */
const lmInfo = async () => {
  const steps = [
    checkGitVersionStep,
    checkGitLFSVersionStep,
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    checkLFSFiltersStep((ctx: $TSFixMe, task: $TSFixMe, installed: $TSFixMe) => {
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

/**
 * Creates the `netlify lm:info` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createLmIn... Remove this comment to see the full error message
const createLmInfoCommand = (program: $TSFixMe) => program.command('lm:info').description('Show large media requirements information.').action(lmInfo)

module.exports = { createLmInfoCommand }
