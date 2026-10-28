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

// Reduces `https://host/owner/repo.git`, `ssh://git@host/owner/repo` and `git@host:owner/repo.git` to
// `host/owner/repo`, ignoring credentials, case and a trailing `.git`. Local paths have no host.
const getRepositoryKey = (repoUrl: string): string | undefined => {
  const parse = (): { host: string; path: string } | undefined => {
    if (repoUrl.startsWith('/')) {
      return { host: '', path: repoUrl }
    }
    const scpLike = /^(?:[^@/]+@)?([^:/]+):(?!\/\/)(.+)$/.exec(repoUrl)
    if (scpLike) {
      return { host: scpLike[1], path: scpLike[2] }
    }
    try {
      const { hostname, pathname } = new URL(repoUrl)
      return { host: hostname, path: pathname }
    } catch {
      return undefined
    }
  }
  const parsed = parse()
  const path = parsed?.path.replace(/^\/+|\/+$/g, '').replace(/\.git$/, '')
  return parsed && path ? `${parsed.host}/${path}`.toLowerCase() : undefined
}

export const isSameRepository = (a: string, b: string): boolean => {
  const keyA = getRepositoryKey(a)
  return keyA !== undefined && keyA === getRepositoryKey(b)
}
