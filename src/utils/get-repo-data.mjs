// @ts-check
import { dirname } from 'path'
import process from 'process'
import util from 'util'

import { findUp } from 'find-up'
import gitRepoInfo from 'git-repo-info'
import gitconfiglocal from 'gitconfiglocal'
import parseGitRemote from 'parse-github-url'

import { log } from './command-helpers.mjs'

/**
 *
 * @param {object} config
 * @param {string} [config.remoteName]
 * @returns
 */
const getRepoData = async function ({ remoteName } = {}) {
  try {
    const cwd = process.cwd()
    const [gitConfig, gitDirectory] = await Promise.all([
      util.promisify(gitconfiglocal)(cwd),
      findUp('.git', { cwd, type: 'directory' }),
    ])

    if (!gitDirectory || !gitConfig || !gitConfig.remote || Object.keys(gitConfig.remote).length === 0) {
      throw new Error('No Git remote found')
    }

    const baseGitPath = dirname(gitDirectory)

    if (cwd !== baseGitPath) {
      log(`Git directory located in ${baseGitPath}`)
    }

    if (!remoteName) {
      const remotes = Object.keys(gitConfig.remote)
      remoteName = remotes.find((remote) => remote === 'origin') || remotes[0]
    }

    if (
      !Object.prototype.hasOwnProperty.call(gitConfig.remote, remoteName) ||
      !gitConfig.remote[remoteName] ||
      Object.keys(gitConfig.remote[remoteName]).length === 0
    ) {
      throw new Error(
        `The specified remote "${remoteName}" is not defined in Git repo. Please use --git-remote-name flag to specify a remote.`,
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
      provider: PROVIDERS[host] || host,
      httpsUrl: `https://${host}/${repo}`,
    }
  } catch (error) {
    return {
      error: error.message,
    }
  }
}

const PROVIDERS = {
  'github.com': 'github',
  'gitlab.com': 'gitlab',
}

export default getRepoData
