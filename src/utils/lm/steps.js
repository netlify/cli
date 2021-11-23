const chalk = require('chalk')

const { checkGitVersion, checkHelperVersion, checkLFSFilters, checkLFSVersion } = require('./requirements')

const checkGitVersionStep = {
  title: 'Checking Git version',
  task: async (ctx, task) => {
    const version = await checkGitVersion()
    task.title += chalk.dim(` [${version}]`)
  },
}

const checkGitLFSVersionStep = {
  title: 'Checking Git LFS version',
  task: async (ctx, task) => {
    const version = await checkLFSVersion()
    task.title += chalk.dim(` [${version}]`)
  },
}

const checkLFSFiltersStep = (onCheckDone) => ({
  title: 'Checking Git LFS filters',
  task: async (ctx, task) => {
    const installed = await checkLFSFilters()
    return onCheckDone(ctx, task, installed)
  },
})

const checkHelperVersionStep = {
  title: `Checking Netlify's Git Credentials version`,
  task: async (ctx, task) => {
    const version = await checkHelperVersion()
    task.title += chalk.dim(` [${version}]`)
  },
}

module.exports = { checkGitVersionStep, checkGitLFSVersionStep, checkLFSFiltersStep, checkHelperVersionStep }
