import type { SiteInfo } from './types.js'

interface ParsedRepoUrl {
  host?: string
  path: string
}

const URL_WITH_SCHEME = /^[a-z][a-z\d+.-]*:\/\//i
const SCP_LIKE_URL = /^(?:[^@/\s]+@)?(?<host>[^:/\s]+):(?<path>[^/].*)$/

// Accepts https, ssh, scp-like (`git@host:owner/repo`) and bare `owner/repo` forms.
export const parseRepoUrl = (url: string): ParsedRepoUrl | undefined => {
  const raw = url.trim()
  let host: string | undefined
  let path = raw

  if (URL_WITH_SCHEME.test(raw)) {
    try {
      const parsed = new URL(raw)
      host = parsed.hostname
      path = parsed.pathname
    } catch {
      return undefined
    }
  } else {
    const scpMatch = SCP_LIKE_URL.exec(raw)
    if (scpMatch?.groups) {
      host = scpMatch.groups.host
      path = scpMatch.groups.path
    }
  }

  const normalizedPath = path.replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '')
  if (normalizedPath === '') {
    return undefined
  }

  return { host: host?.toLowerCase(), path: normalizedPath }
}

// Mirrors the API's `repo_url` site filter, so results agree whether or not the API applied it.
export const siteMatchesRepoUrl = (site: SiteInfo, repoUrl: string): boolean => {
  const target = parseRepoUrl(repoUrl)
  const stored = parseRepoUrl(site.build_settings?.repo_url ?? '')
  if (target === undefined || stored?.path.toLowerCase() !== target.path.toLowerCase()) {
    return false
  }

  // Manual repos may store a bare `owner/repo`, which names that repo on any host.
  if (site.build_settings?.provider === 'manual' && stored.host === undefined) {
    return true
  }

  return target.host !== undefined && stored.host === target.host
}
