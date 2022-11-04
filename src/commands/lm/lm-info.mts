// @ts-check

import Listr from 'listr'

const {
  
  checkGitLFSVersionStep,
  
  checkGitVersionStep,
  
  checkHelperVersionStep,
  
  checkLFSFiltersStep,
} = require('../../utils/lm/steps.mjs')

/**
 * The lm:info command
 */
const lmInfo = async () => {
  const steps = [
    checkGitVersionStep,
    checkGitLFSVersionStep,
    
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

const createLmInfoCommand = (program: $TSFixMe) => program.command('lm:info').description('Show large media requirements information.').action(lmInfo)

export default { createLmInfoCommand }
