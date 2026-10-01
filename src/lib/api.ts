import { setTimeout } from 'node:timers/promises'

import type { NetlifyAPI } from '@netlify/api'
import fetch, { type RequestInit, type Response } from 'node-fetch'

import { warn } from '../utils/command-helpers.js'
import { formatRepoUrl, parseRepoUrl, siteMatchesRepoUrl } from '../utils/match-repo-url.js'
import type { SiteInfo } from '../utils/types.js'

export const cancelDeploy = async ({ api, deployId }: { api: NetlifyAPI; deployId: string }): Promise<void> => {
  try {
    await api.cancelSiteDeploy({ deploy_id: deployId })
  } catch (error) {
    warn(
      `Failed canceling deploy with id ${deployId}: ${
        error instanceof Error ? error.message : (error?.toString() ?? '')
      }`,
    )
  }
}

const FIRST_PAGE = 1
const MAX_PAGES = 10
const MAX_PER_PAGE = 100

interface SitesPageParams {
  name?: string
  name_match_mode?: 'contains' | 'exact'
  repo_url?: string
  filter?: 'all' | 'owner' | 'guest'
  page?: number
  per_page?: number
}

// Mirrors @netlify/api's retry policy (`lib/methods/retry.js`), which this direct request bypasses.
const MAX_RETRIES = 5
const DEFAULT_RETRY_DELAY_MS = 5_000
const MIN_RETRY_DELAY_MS = 1_000
const RETRYABLE_ERROR_CODES = new Set(['ETIMEDOUT', 'ECONNRESET'])

const getRetryDelayMs = (response?: Response): number => {
  const rateLimitReset = response?.headers.get('X-RateLimit-Reset')
  return rateLimitReset
    ? Math.max(Number(rateLimitReset) * 1_000 - Date.now(), MIN_RETRY_DELAY_MS)
    : DEFAULT_RETRY_DELAY_MS
}

const fetchWithRetry = async (url: URL, init: RequestInit): Promise<Response> => {
  for (let attempt = 0; ; attempt++) {
    let response: Response
    try {
      response = await fetch(url, init)
    } catch (error) {
      if (attempt < MAX_RETRIES && RETRYABLE_ERROR_CODES.has((error as NodeJS.ErrnoException).code ?? '')) {
        await setTimeout(DEFAULT_RETRY_DELAY_MS)
        continue
      }
      throw error
    }
    if (response.status === 429 && attempt < MAX_RETRIES) {
      await setTimeout(getRetryDelayMs(response))
      continue
    }
    return response
  }
}

// TODO: Replace with `api.listSites` once `name_match_mode` and `repo_url` are added to @netlify/open-api.
// Until then the client silently drops them, turning a targeted lookup back into a list of every site.
const fetchSitesPageWithUnpublishedParams = async (api: NetlifyAPI, params: SitesPageParams): Promise<unknown[]> => {
  const url = new URL(`${api.basePath}/sites`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value))
    }
  }

  const response = await fetchWithRetry(url, {
    headers: api.defaultHeaders,
    agent: api.agent as unknown as RequestInit['agent'],
  })
  const body = await response.text()
  if (!response.ok) {
    // Same shape as @netlify/api's `JSONHTTPError`/`TextHTTPError`, which callers format.
    let json: unknown
    try {
      json = JSON.parse(body)
    } catch {
      json = undefined
    }
    throw Object.assign(new Error(response.statusText || body), { status: response.status, json, data: body })
  }

  return JSON.parse(body) as unknown[]
}

const fetchSitesPage = async (api: NetlifyAPI, params: SitesPageParams): Promise<SiteInfo[]> => {
  const sites =
    params.name_match_mode === undefined && params.repo_url === undefined
      ? await api.listSites(params)
      : await fetchSitesPageWithUnpublishedParams(api, params)
  // FIXME(serhalp): `id` and `name` should be required in `netlify` package type
  return sites as SiteInfo[]
}

export const listSites = async ({
  api,
  options,
}: {
  api: NetlifyAPI
  options: SitesPageParams & { maxPages?: number }
}): Promise<SiteInfo[]> => {
  const { maxPages = MAX_PAGES, page = FIRST_PAGE, ...rest } = options
  const sites = await fetchSitesPage(api, { page, per_page: MAX_PER_PAGE, ...rest })
  // TODO: use pagination headers when js-client returns them
  if (sites.length === MAX_PER_PAGE && page + 1 <= maxPages) {
    return [...sites, ...(await listSites({ api, options: { page: page + 1, maxPages, ...rest } }))]
  }
  return sites
}

export const findSiteByName = async (api: NetlifyAPI, name: string): Promise<SiteInfo | undefined> => {
  const sites = await fetchSitesPage(api, { name, name_match_mode: 'exact', filter: 'all' })
  // API versions predating `name_match_mode` treat `name` as a substring search.
  return sites.find((site) => site.name.toLowerCase() === name.toLowerCase())
}

export const listSitesByRepoUrl = async (api: NetlifyAPI, repoUrl: string): Promise<SiteInfo[]> => {
  const target = parseRepoUrl(repoUrl)
  if (target === undefined) {
    return []
  }

  const sites = await listSites({ api, options: { repo_url: formatRepoUrl(target), filter: 'all' } })
  // API versions predating `repo_url` ignore it and return every site.
  return sites.filter((site) => siteMatchesRepoUrl(site, repoUrl))
}
