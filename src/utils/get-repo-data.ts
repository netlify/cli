// @ts-check
// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const { dirname } = require('path')
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'process'.
const process = require('process')
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'util'.
const util = require('util')

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'findUp'.
const findUp = require('find-up')
// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const gitRepoInfo = require('git-repo-info')
// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const gitconfiglocal = require('gitconfiglocal')
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'isEmpty'.
const isEmpty = require('lodash/isEmpty')
// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const parseGitRemote = require('parse-github-url')

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'log'.
const { log } = require('./command-helpers.cjs')

/**
 *
 * @param {object} config
 * @param {string} [config.remoteName]
 * @returns
 */
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'getRepoDat... Remove this comment to see the full error message
const getRepoData = async function ({
  remoteName
}: any = {}) {
  try {
    const cwd = process.cwd()
    const [gitConfig, gitDirectory] = await Promise.all([
      util.promisify(gitconfiglocal)(cwd),
      findUp('.git', { cwd, type: 'directory' }),
    ])
    const baseGitPath = dirname(gitDirectory)

    if (cwd !== baseGitPath) {
      log(`Git directory located in ${baseGitPath}`)
    }

    if (isEmpty(gitConfig) || isEmpty(gitConfig.remote)) {
      throw new Error('No Git remote found')
    }

    if (!remoteName) {
      const remotes = Object.keys(gitConfig.remote)
      remoteName = remotes.find((remote) => remote === 'origin') || remotes[0]
    }

    if (!Object.prototype.hasOwnProperty.call(gitConfig.remote, remoteName) || isEmpty(gitConfig.remote[remoteName])) {
      throw new Error(
        `The specified remote "${remoteName}" is not defined in Git repo. Please use --gitRemoteName flag to specify a remote.`,
      )
    }

    const { url } = gitConfig.remote[remoteName]
    const { host, name, owner, repo } = parseGitRemote(url)
    const { branch } = gitRepoInfo()
    return {
      name,
      owner,
      repo,
      url,
      branch,
      // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      provider: PROVIDERS[host] || host,
      httpsUrl: `https://${host}/${repo}`,
    }
  } catch (error) {
    return {
    error: (error as any).message,
};
  }
}

const PROVIDERS = {
  'github.com': 'github',
  'gitlab.com': 'gitlab',
}

// @ts-expect-error TS(2580) FIXME: Cannot find name 'module'. Do you need to install ... Remove this comment to see the full error message
module.exports = { getRepoData }
