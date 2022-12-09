import { chalk } from '../command-helpers.mjs'

import { checkGitVersion, checkHelperVersion, checkLFSFilters, checkLFSVersion } from './requirements.mjs'

export const checkGitVersionStep = {
  title: 'Checking Git version',
  task: async (ctx, task) => {
    const version = await checkGitVersion()
    task.title += chalk.dim(` [${version}]`)
  },
}

export const checkGitLFSVersionStep = {
  title: 'Checking Git LFS version',
  task: async (ctx, task) => {
    const version = await checkLFSVersion()
    task.title += chalk.dim(` [${version}]`)
  },
}

export const checkLFSFiltersStep = (onCheckDone) => ({
  title: 'Checking Git LFS filters',
  task: async (ctx, task) => {
    const installed = await checkLFSFilters()
    return onCheckDone(ctx, task, installed)
  },
})

export const checkHelperVersionStep = {
  title: `Checking Netlify's Git Credentials version`,
  task: async (ctx, task) => {
    const version = await checkHelperVersion()
    task.title += chalk.dim(` [${version}]`)
  },
}
