import parseGithubUrl from 'parse-github-url'

const BARE_OWNER_REPO_PATTERN = /^[^\s/]+\/[^\s/]+$/

export const matchesRepoUrl = (inputUrl: string, storedRepoUrl: string | undefined): boolean => {
  if (!storedRepoUrl) {
    return false
  }

  const parsedInput = parseGithubUrl(inputUrl)
  if (!parsedInput?.owner || !parsedInput.name) {
    return false
  }

  if (BARE_OWNER_REPO_PATTERN.test(storedRepoUrl)) {
    const normalizedStoredRepoUrl = storedRepoUrl.replace(/\.git$/i, '')
    return normalizedStoredRepoUrl.toLowerCase() === `${parsedInput.owner}/${parsedInput.name}`.toLowerCase()
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
