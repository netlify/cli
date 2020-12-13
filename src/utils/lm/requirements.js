const chalk = require('chalk')
const execa = require('execa')
const semver = require('semver')

const GitValidators = [
  {
    title: 'Checking Git version',
    task: async (ctx, task) => {
      const version = await checkGitVersion()
      task.title += chalk.dim(` [${version}]`)
    },
  },
  {
    title: 'Checking Git LFS version',
    task: async (ctx, task) => {
      const version = await checkLFSVersion()
      task.title += chalk.dim(` [${version}]`)
    },
  },
]

const checkLFSFilters = async function () {
  try {
    const result = await execa('git', ['config', '--get-regexp', 'filter.lfs'])
    return result.stdout.length > 0
  } catch (error) {
    return Promise.resolve(false)
  }
}

const checkHelperVersion = async function () {
  try {
    const result = await execa('git-credential-netlify', ['--version'])
    return matchVersion(
      result.stdout,
      /git-credential-netlify\/([.\d]+).*/,
      '0.1.1',
      `Invalid Netlify's Git Credential version. Please update to version 2.5.1 or above`,
    )
  } catch (error) {
    throw new Error(`Check that Netlify's Git Credential helper is installed and updated to the latest version`)
  }
}

const checkGitVersion = async function () {
  try {
    const result = await execa('git', ['--version'])
    return result.stdout.split(' ').pop()
  } catch (error) {
    throw new Error('Check that Git is installed in your system')
  }
}

const checkLFSVersion = async function () {
  try {
    const result = await execa('git-lfs', ['--version'])
    return matchVersion(
      result.stdout,
      /git-lfs\/([.\d]+).*/,
      '2.5.1',
      'Invalid Git LFS version. Please update to version 2.5.1 or above',
    )
  } catch (error) {
    throw new Error('Check that Git LFS is installed in your system')
  }
}

const matchVersion = function (out, regex, version, message) {
  const match = out.match(regex)
  if (!match || match.length !== 2 || semver.lt(match[1], version)) {
    throw new Error(message)
  }
  return match[1]
}

module.exports = {
  GitValidators,
  checkLFSFilters,
  checkHelperVersion,
}
