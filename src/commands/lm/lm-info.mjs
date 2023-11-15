// @ts-check
import { Listr } from 'listr2'

import {
  checkGitLFSVersionStep,
  checkGitVersionStep,
  checkHelperVersionStep,
  checkLFSFiltersStep,
} from '../../utils/lm/steps.mjs'

/**
 * The lm:info command
 */
export const lmInfo = async () => {
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
