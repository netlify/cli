import type { SiteInfo } from './types.js'

export interface ParsedRepoUrl {
  host?: string
  path: string
}

// Kept identical to the API's `Repo::UrlLookup.parse` so both sides agree on what a remote names.
const URL_WITH_SCHEME = /^[a-z][a-z\d+.-]*:\/\/(?:[^/?#]*@)?(?<host>[^/?#:]+)(?::\d*)?(?<path>[^?#]*)/i
const SCP_LIKE_URL = /^(?:[^@/\s]+@)?(?<host>[^:/\s]+):(?<path>[^/].*)$/

// Accepts https, ssh, scp-like (`git@host:owner/repo`) and bare `owner/repo` forms. Userinfo and
// ports are discarded, so embedded credentials never leave the machine.
export const parseRepoUrl = (url: string): ParsedRepoUrl | undefined => {
  const raw = url.trim()
  const groups = (URL_WITH_SCHEME.exec(raw) ?? SCP_LIKE_URL.exec(raw))?.groups
  const normalizedPath = (groups?.path ?? raw).replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '')
  if (normalizedPath === '') {
    return undefined
  }

  return { host: groups?.host.toLowerCase(), path: normalizedPath }
}

export const formatRepoUrl = ({ host, path }: ParsedRepoUrl): string =>
  host === undefined ? path : `https://${host}/${path}`

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
