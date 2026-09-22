import parseGithubUrl from 'parse-github-url'

const BARE_OWNER_REPO_PATTERN = /^[^\s/]+\/[^\s/]+$/

/**
 * Determines whether a user-provided git remote URL refers to the same repository as a
 * `manual` provider site's stored `build_settings.repo_url`.
 *
 * `manual` provider sites (e.g. a self-hosted git host with no native Netlify integration) can
 * have a stored `repo_url` that's just a bare `owner/repo` path rather than a full URL, which
 * will never `===` a real git remote URL like `git@host:owner/repo.git`. Intended to be used as
 * a fallback alongside exact-string matching, gated on `build_settings.provider === 'manual'` -
 * other providers rely on their own API to keep `repo_url` well-formed, so exact matching alone
 * is sufficient for them.
 */
export const matchesRepoUrl = (inputUrl: string, storedRepoUrl: string | undefined): boolean => {
  if (!storedRepoUrl) {
    return false
  }

  const parsedInput = parseGithubUrl(inputUrl)
  if (!parsedInput?.owner || !parsedInput.name) {
    return false
  }

  if (BARE_OWNER_REPO_PATTERN.test(storedRepoUrl)) {
    return storedRepoUrl.toLowerCase() === `${parsedInput.owner}/${parsedInput.name}`.toLowerCase()
  }

  const parsedStored = parseGithubUrl(storedRepoUrl)
  if (!parsedStored?.owner || !parsedStored.name || !parsedStored.host) {
    return false
  }

  return (
    parsedInput.host?.toLowerCase() === parsedStored.host.toLowerCase() &&
    parsedInput.owner.toLowerCase() === parsedStored.owner.toLowerCase() &&
    parsedInput.name.toLowerCase() === parsedStored.name.toLowerCase()
  )
}
