// TODO: Migrate to @netlify/api once these endpoints are public.
// Method names mirror the backend @operation_id to keep the future swap quick.

import type { NetlifyOptions } from '../types.js'
import { parseLinkHeader } from './utils.js'
import type {
  AgentRunner,
  AgentRunnerSession,
  AiGatewayProvidersResponse,
  CreateAgentRunnerPayload,
  CreateAgentRunnerSessionPayload,
  DeleteUrlResponse,
  DiffParams,
  ListAgentRunnerSessionsFilters,
  ListAgentRunnersFilters,
  PaginatedResult,
  UploadUrlResponse,
} from './types.js'

const DEFAULT_PER_PAGE = 100

type RawResponseHandler<T> = (response: Response) => Promise<T>

type SearchParamValue = string | number | boolean | null | undefined

const buildSearchParams = (entries: Record<string, SearchParamValue>): URLSearchParams => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, value.toString())
  }
  return params
}

const readPagination = (response: Response, page: number, perPage: number): { total?: number; hasNext: boolean } => {
  const totalHeader = response.headers.get('Total')
  const total = totalHeader != null ? Number.parseInt(totalHeader, 10) : undefined
  const links = parseLinkHeader(response.headers.get('Link'))
  const hasNext = Boolean(links.next) || (total != null && page * perPage < total)
  return { total: Number.isFinite(total) ? total : undefined, hasNext }
}

export const createAgentsApi = (netlify: NetlifyOptions) => {
  const { api, apiOpts } = netlify
  const baseUrl = api.basePath

  const baseHeaders = (extra: Record<string, string> = {}): Record<string, string> => ({
    Authorization: `Bearer ${api.accessToken ?? ''}`,
    'User-Agent': apiOpts.userAgent,
    ...extra,
  })

  const throwForStatus = async (response: Response): Promise<never> => {
    const errorData = (await response.json().catch(() => ({}))) as { error?: string }
    const error = new Error(
      errorData.error ?? `HTTP ${response.status.toString()}: ${response.statusText}`,
    ) as Error & { status?: number }
    error.status = response.status
    throw error
  }

  const requestRaw = async <T>(path: string, init: RequestInit, handler: RawResponseHandler<T>): Promise<T> => {
    const response = await fetch(`${baseUrl}${path}`, init)
    if (!response.ok) await throwForStatus(response)
    return handler(response)
  }

  const requestJson = async <T>(path: string, init: RequestInit = {}): Promise<T> =>
    requestRaw(path, init, async (response) => {
      if (response.status === 202) return undefined as T
      const text = await response.text()
      if (!text) return undefined as T
      return JSON.parse(text) as T
    })

  const requestNoContent = (path: string, init: RequestInit = {}): Promise<void> =>
    requestRaw(path, init, () => Promise.resolve(undefined))

  const jsonInit = (method: string, body?: unknown): RequestInit => ({
    method,
    headers: baseHeaders(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const getInit = (): RequestInit => ({ method: 'GET', headers: baseHeaders() })

  const listAgentRunners = async (
    siteId: string,
    filters: ListAgentRunnersFilters = {},
  ): Promise<PaginatedResult<AgentRunner[]>> => {
    const page = filters.page ?? 1
    const perPage = filters.per_page ?? DEFAULT_PER_PAGE
    const params = buildSearchParams({ ...filters, site_id: siteId, page, per_page: perPage })
    const response = await fetch(`${baseUrl}/agent_runners?${params.toString()}`, getInit())
    if (!response.ok) await throwForStatus(response)
    const data = (await response.json()) as AgentRunner[]
    const { total, hasNext } = readPagination(response, page, perPage)
    return { data, total, page, perPage, hasNext }
  }

  const listAgentRunnersForAccount = async (
    accountSlug: string,
    filters: ListAgentRunnersFilters = {},
  ): Promise<PaginatedResult<AgentRunner[]>> => {
    const page = filters.page ?? 1
    const perPage = filters.per_page ?? DEFAULT_PER_PAGE
    const params = buildSearchParams({ ...filters, page, per_page: perPage })
    const response = await fetch(
      `${baseUrl}/${encodeURIComponent(accountSlug)}/agent_runners?${params.toString()}`,
      getInit(),
    )
    if (!response.ok) await throwForStatus(response)
    const data = (await response.json()) as AgentRunner[]
    const { total, hasNext } = readPagination(response, page, perPage)
    return { data, total, page, perPage, hasNext }
  }

  const getAgentRunner = (id: string): Promise<AgentRunner> =>
    requestJson<AgentRunner>(`/agent_runners/${encodeURIComponent(id)}`, getInit())

  const createAgentRunner = (siteId: string, payload: CreateAgentRunnerPayload): Promise<AgentRunner> => {
    const params = buildSearchParams({ site_id: siteId })
    return requestJson<AgentRunner>(`/agent_runners?${params.toString()}`, jsonInit('POST', payload))
  }

  const deleteAgentRunner = (id: string): Promise<void> =>
    requestNoContent(`/agent_runners/${encodeURIComponent(id)}`, { method: 'DELETE', headers: baseHeaders() })

  const archiveAgentRunner = (id: string): Promise<void> =>
    requestNoContent(`/agent_runners/${encodeURIComponent(id)}/archive`, { method: 'POST', headers: baseHeaders() })

  const listAgentRunnerSessions = async (
    id: string,
    filters: ListAgentRunnerSessionsFilters = {},
  ): Promise<AgentRunnerSession[]> => {
    const page = filters.page ?? 1
    const perPage = filters.per_page ?? DEFAULT_PER_PAGE
    const params = buildSearchParams({ ...filters, page, per_page: perPage })
    return requestJson<AgentRunnerSession[]>(
      `/agent_runners/${encodeURIComponent(id)}/sessions?${params.toString()}`,
      getInit(),
    )
  }

  const getAgentRunnerSession = (id: string, sessionId: string): Promise<AgentRunnerSession> =>
    requestJson<AgentRunnerSession>(
      `/agent_runners/${encodeURIComponent(id)}/sessions/${encodeURIComponent(sessionId)}`,
      getInit(),
    )

  const createAgentRunnerSession = (
    id: string,
    payload: CreateAgentRunnerSessionPayload,
  ): Promise<AgentRunnerSession> =>
    requestJson<AgentRunnerSession>(`/agent_runners/${encodeURIComponent(id)}/sessions`, jsonInit('POST', payload))

  const redeployAgentRunnerSession = (id: string, sessionId: string): Promise<AgentRunnerSession> =>
    requestJson<AgentRunnerSession>(
      `/agent_runners/${encodeURIComponent(id)}/sessions/${encodeURIComponent(sessionId)}/redeploy`,
      jsonInit('POST'),
    )

  const getAgentRunnerDiff = async (id: string, params: DiffParams = {}): Promise<PaginatedResult<string>> => {
    const page = params.page ?? 1
    const perPage = params.per_page ?? DEFAULT_PER_PAGE
    const stripBinary = params.strip_binary ?? true
    const search = buildSearchParams({ page, per_page: perPage, strip_binary: stripBinary })
    const response = await fetch(
      `${baseUrl}/agent_runners/${encodeURIComponent(id)}/diff?${search.toString()}`,
      getInit(),
    )
    if (!response.ok) {
      if (response.status === 404) return { data: '', total: 0, page, perPage, hasNext: false }
      await throwForStatus(response)
    }
    const body = await response.text()
    const { total, hasNext } = readPagination(response, page, perPage)
    return { data: body, total, page, perPage, hasNext }
  }

  const getSessionDiff = async (id: string, sessionId: string, kind: 'result' | 'cumulative'): Promise<string> => {
    const response = await fetch(
      `${baseUrl}/agent_runners/${encodeURIComponent(id)}/sessions/${encodeURIComponent(sessionId)}/diff/${kind}`,
      getInit(),
    )
    if (!response.ok) {
      if (response.status === 404) return ''
      await throwForStatus(response)
    }
    return response.text()
  }

  const agentRunnerPullRequest = (id: string): Promise<AgentRunner> =>
    requestJson<AgentRunner>(`/agent_runners/${encodeURIComponent(id)}/pull_request`, jsonInit('POST'))

  const agentRunnerCommitToBranch = (id: string, targetBranch: string): Promise<AgentRunner> =>
    requestJson<AgentRunner>(
      `/agent_runners/${encodeURIComponent(id)}/commit`,
      jsonInit('POST', { target_branch: targetBranch }),
    )

  const agentRunnerPublishToProduction = (id: string): Promise<AgentRunner> =>
    requestJson<AgentRunner>(`/agent_runners/${encodeURIComponent(id)}/publish_to_production`, jsonInit('POST'))

  const revertAgentRunner = (id: string, sessionId: string): Promise<AgentRunner> =>
    requestJson<AgentRunner>(
      `/agent_runners/${encodeURIComponent(id)}/revert`,
      jsonInit('POST', { session_id: sessionId }),
    )

  const updateAgentRunner = (id: string, payload: { title?: string; base_deploy_id?: string }): Promise<AgentRunner> =>
    requestJson<AgentRunner>(`/agent_runners/${encodeURIComponent(id)}`, jsonInit('PATCH', payload))

  const rebaseAgentRunner = (id: string): Promise<AgentRunner> =>
    requestJson<AgentRunner>(`/agent_runners/${encodeURIComponent(id)}/rebase`, jsonInit('POST'))

  const mergeTargetAgentRunner = (id: string): Promise<AgentRunner> =>
    requestJson<AgentRunner>(`/agent_runners/${encodeURIComponent(id)}/merge_target`, jsonInit('POST'))

  const syncGitOriginAgentRunner = (id: string): Promise<AgentRunner> =>
    requestJson<AgentRunner>(`/agent_runners/${encodeURIComponent(id)}/sync_git_origin`, jsonInit('POST'))

  const createAgentRunnerUploadUrl = (payload: {
    account_id: string
    filename: string
    content_type: string
  }): Promise<UploadUrlResponse> =>
    requestJson<UploadUrlResponse>(`/agent_runners/upload_url`, jsonInit('POST', payload))

  const createAgentRunnerDeleteUrl = (payload: { account_id: string; file_key: string }): Promise<DeleteUrlResponse> =>
    requestJson<DeleteUrlResponse>(`/agent_runners/delete_url`, jsonInit('POST', payload))

  let providersCache: AiGatewayProvidersResponse | null = null
  const listAiGatewayProviders = async (): Promise<AiGatewayProvidersResponse> => {
    if (providersCache) return providersCache
    // Public endpoint by design — no auth header. The provider+model list is meant
    // for external clients to discover the agent → provider → model relationship.
    const response = await fetch(`${baseUrl}/ai-gateway/providers`)
    if (!response.ok) await throwForStatus(response)
    providersCache = (await response.json()) as AiGatewayProvidersResponse
    return providersCache
  }

  return {
    listAgentRunners,
    listAgentRunnersForAccount,
    getAgentRunner,
    createAgentRunner,
    updateAgentRunner,
    deleteAgentRunner,
    archiveAgentRunner,
    listAgentRunnerSessions,
    getAgentRunnerSession,
    createAgentRunnerSession,
    redeployAgentRunnerSession,
    getAgentRunnerDiff,
    getSessionResultDiff: (id: string, sessionId: string) => getSessionDiff(id, sessionId, 'result'),
    getSessionCumulativeDiff: (id: string, sessionId: string) => getSessionDiff(id, sessionId, 'cumulative'),
    agentRunnerPullRequest,
    agentRunnerCommitToBranch,
    agentRunnerPublishToProduction,
    revertAgentRunner,
    rebaseAgentRunner,
    mergeTargetAgentRunner,
    syncGitOriginAgentRunner,
    createAgentRunnerUploadUrl,
    createAgentRunnerDeleteUrl,
    listAiGatewayProviders,
  }
}

export type AgentsApi = ReturnType<typeof createAgentsApi>
