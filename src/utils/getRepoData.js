const gitRepoInfo = require('git-repo-info')
const parseGitRemote = require('parse-github-url')
const gitRemoteOriginUrl = require('git-remote-origin-url')

async function getRepoData() {
  let repo = {}
  try {
    const remoteUrl = await gitRemoteOriginUrl()
    if (!remoteUrl) {
      console.log('NO REPO')
      // TODO throw here?
      return {}
    }
    const remoteData = parseGitRemote(remoteUrl)
    const repoData = gitRepoInfo()

    // TODO refactor?
    repo = {
      remoteData: remoteData,
      repoData: repoData,
      repo_path: remoteData.path,
      repo_branch: repoData.branch,
      allowed_branches: [repoData.branch]
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
