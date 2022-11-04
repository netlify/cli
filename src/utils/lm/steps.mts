// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'chalk'.
const { chalk } = require('../command-helpers.cjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'checkGitVe... Remove this comment to see the full error message
const { checkGitVersion, checkHelperVersion, checkLFSFilters, checkLFSVersion } = require('./requirements.cjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'checkGitVe... Remove this comment to see the full error message
const checkGitVersionStep = {
  title: 'Checking Git version',
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  task: async (ctx: $TSFixMe, task: $TSFixMe) => {
    const version = await checkGitVersion()
    task.title += chalk.dim(` [${version}]`)
  },
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'checkGitLF... Remove this comment to see the full error message
const checkGitLFSVersionStep = {
  title: 'Checking Git LFS version',
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  task: async (ctx: $TSFixMe, task: $TSFixMe) => {
    const version = await checkLFSVersion()
    task.title += chalk.dim(` [${version}]`)
  },
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'checkLFSFi... Remove this comment to see the full error message
const checkLFSFiltersStep = (onCheckDone: $TSFixMe) => ({
  title: 'Checking Git LFS filters',

  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  task: async (ctx: $TSFixMe, task: $TSFixMe) => {
    const installed = await checkLFSFilters()
    return onCheckDone(ctx, task, installed)
  }
})

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'checkHelpe... Remove this comment to see the full error message
const checkHelperVersionStep = {
  title: `Checking Netlify's Git Credentials version`,
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  task: async (ctx: $TSFixMe, task: $TSFixMe) => {
    const version = await checkHelperVersion()
    task.title += chalk.dim(` [${version}]`)
  },
}

module.exports = { checkGitVersionStep, checkGitLFSVersionStep, checkLFSFiltersStep, checkHelperVersionStep }
