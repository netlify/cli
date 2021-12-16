// @ts-check
const semver = require('semver')

const execa = require('../execa')

const checkLFSFilters = async function () {
  try {
    const { stdout } = await execa('git', ['config', '--get-regexp', 'filter.lfs'])
    return stdout.length !== 0
  } catch (error) {
    return false
  }
}

const getHelperVersion = async function () {
  try {
    const { stdout } = await execa('git-credential-netlify', ['version'])
    return stdout
  } catch (error) {
    throw new Error(`Check that Netlify's Git Credential helper is installed and updated to the latest version`)
  }
}

const checkHelperVersion = async function () {
  const version = await getHelperVersion()
  const expectedVersion = '0.1.10'
  return matchVersion(
    version,
    /git-credential-netlify\/([.\d]+).*/,
    expectedVersion,
    `Invalid Netlify's Git Credential version MATCH_PLACEHOLDER. Please update to version ${expectedVersion} or above by running 'ntl lm:install'`,
  )
}

const checkGitVersion = async function () {
  try {
    const { stdout } = await execa('git', ['--version'])
    return stdout.split(' ').pop()
  } catch (error) {
    throw new Error('Check that Git is installed in your system')
  }
}

const getLFSVersion = async function () {
  try {
    const { stdout } = await execa('git-lfs', ['version'])
    return stdout
  } catch (error) {
    throw new Error('Check that Git LFS is installed in your system')
  }
}

const checkLFSVersion = async function () {
  const version = await getLFSVersion()
  const expectedVersion = '2.5.1'
  return matchVersion(
    version,
    /git-lfs\/([.\d]+).*/,
    expectedVersion,
    `Invalid Git LFS version MATCH_PLACEHOLDER. Please update to version ${expectedVersion} or above`,
  )
}

const matchVersion = function (out, regex, version, message) {
  const match = out.match(regex)
  if (!match || match.length !== 2 || semver.lt(match[1], version)) {
    throw new Error(message.replace('MATCH_PLACEHOLDER', match[1]))
  }
  return match[1]
}

module.exports = {
  checkGitVersion,
  checkLFSVersion,
  checkLFSFilters,
  checkHelperVersion,
}
