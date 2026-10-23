export const NETLIFY_GIT_HOST = 'git.netlify.com'

const NETLIFY_GIT_SERVICE_HOST = 'hgit.services-prod.nsvcs.net'

export const isNetlifyGitUrl = (repoUrl: string): boolean => {
  try {
    const { host } = new URL(repoUrl)
    return host === NETLIFY_GIT_HOST || host === NETLIFY_GIT_SERVICE_HOST
  } catch {
    return false
  }
}
