
const { chalk } = require('../command-helpers.mjs')


const { checkGitVersion, checkHelperVersion, checkLFSFilters, checkLFSVersion } = require('./requirements.mjs')


const checkGitVersionStep = {
  title: 'Checking Git version',
  
  task: async (ctx: $TSFixMe, task: $TSFixMe) => {
    const version = await checkGitVersion()
    task.title += chalk.dim(` [${version}]`)
  },
}


const checkGitLFSVersionStep = {
  title: 'Checking Git LFS version',
  
  task: async (ctx: $TSFixMe, task: $TSFixMe) => {
    const version = await checkLFSVersion()
    task.title += chalk.dim(` [${version}]`)
  },
}


const checkLFSFiltersStep = (onCheckDone: $TSFixMe) => ({
  title: 'Checking Git LFS filters',

  
  task: async (ctx: $TSFixMe, task: $TSFixMe) => {
    const installed = await checkLFSFilters()
    return onCheckDone(ctx, task, installed)
  }
})


const checkHelperVersionStep = {
  title: `Checking Netlify's Git Credentials version`,
  
  task: async (ctx: $TSFixMe, task: $TSFixMe) => {
    const version = await checkHelperVersion()
    task.title += chalk.dim(` [${version}]`)
  },
}

export default { checkGitVersionStep, checkGitLFSVersionStep, checkLFSFiltersStep, checkHelperVersionStep }
