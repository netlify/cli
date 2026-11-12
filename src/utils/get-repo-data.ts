import { dirname } from 'path'
import util from 'util'

import { findUp } from 'find-up'
import gitRepoInfo from 'git-repo-info'
import gitconfiglocal from 'gitconfiglocal'
import parseGithubUrl from 'parse-github-url'

import { log } from './command-helpers.js'

export interface RepoData {
  name: string | null
  owner: string | null
  repo: string | null
  url: string
  branch: string
  provider: string | null
  httpsUrl: string
}

export type RepoDataErrorReason = 'no-remote' | 'unknown-remote' | 'invalid-url' | 'unreadable'

export interface RepoDataError {
  error: string
  reason: RepoDataErrorReason
}

class RepoDataLookupError extends Error {
  constructor(
    message: string,
    readonly reason: RepoDataErrorReason,
  ) {
    super(message)
  }
}

const redactCredentials = (url: string): string => url.replace(/\/\/[^/@]*@/, '//***@')

const getRepoData = async ({
  remoteName,
  workingDir,
}: {
  remoteName?: string
  workingDir: string
}): Promise<RepoData | RepoDataError> => {
  try {
    const gitDirectory = await findUp('.git', { cwd: workingDir, type: 'directory' })
    if (!gitDirectory) {
      throw new RepoDataLookupError('No Git remote found', 'no-remote')
    }
    const gitConfig = await util.promisify(gitconfiglocal)(workingDir)

    if (!gitConfig?.remote || Object.keys(gitConfig.remote).length === 0) {
      throw new RepoDataLookupError('No Git remote found', 'no-remote')
    }

    const baseGitPath = dirname(gitDirectory)

    if (workingDir !== baseGitPath) {
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
      throw new RepoDataLookupError(
        `The specified remote "${remoteName}" is not defined in Git repo. Please use --git-remote-name flag to specify a remote.`,
        'unknown-remote',
      )
    }

    const { url } = gitConfig.remote[remoteName]
    const parsedUrl = parseGithubUrl(url)
    // TODO(serhalp): Validate more aggressively? We should probably require `owner`, `repo`, `host`?
    if (parsedUrl == null) {
      throw new RepoDataLookupError(
        `The specified Git remote ${remoteName} is not a valid URL: ${redactCredentials(String(url))}`,
        'invalid-url',
      )
    }
    const { host, name, owner, repo } = parsedUrl
    const { branch } = gitRepoInfo()
    return {
      name,
      owner,
      repo,
      url,
      branch,
      provider: host != null ? (PROVIDERS[host] ?? host) : host,
      httpsUrl: `https://${host}/${repo}`,
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : (error?.toString() ?? 'Failed to get repo data'),
      reason: error instanceof RepoDataLookupError ? error.reason : 'unreadable',
    }
  }
}

const PROVIDERS: Record<string, string> = {
  'github.com': 'github',
  'gitlab.com': 'gitlab',
}

export default getRepoData
