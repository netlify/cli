const path = require('path')
const findUp = require('find-up')
const gitRepoInfo = require('git-repo-info')
const parseGitRemote = require('parse-github-url')
const gitRemoteOriginUrl = require('git-remote-origin-url')

async function getRepoData() {
  const cwd = process.cwd()
  let repo = {}
  try {
    const remoteUrl = await gitRemoteOriginUrl()
    const gitDirectory = findUp.sync(['.git'], { cwd: cwd })
    const baseGitPath = path.dirname(gitDirectory)

    if (cwd !== baseGitPath) {
      console.log(`git directory located in ${baseGitPath}`)
      // TODO prompt for "is this the correct git remote"?
      // If folder gitignored inside another git repo it could link to wrong repo.
    }

    if (!remoteUrl) {
      console.log('NO REPO FOUND')
      // TODO throw here?
      return {}
    }
    const remoteData = parseGitRemote(remoteUrl)
    const repoData = gitRepoInfo()

    // TODO refactor shape
    repo = {
      gitDirectoryPath: gitDirectory,
      remoteData: remoteData,
      repoData: repoData,
      repo_path: remoteData.path,
      repo_branch: repoData.branch,
      allowed_branches: [repoData.branch],
      host: remoteData.host
    }

    switch (remoteData.host) {
      case 'github.com': {
        repo.provider = 'github'
        break
      }
      case 'gitlab.com': {
        repo.provider = 'gitlab'
        break
      }
    }
  } catch (error) {
    // console.log('error', error)
    return {
      error: error.message
    }
  }

  return repo
}

module.exports = getRepoData
