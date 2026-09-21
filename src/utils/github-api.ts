import type { operations } from '@octokit/openapi-types'

// Hand-rolled GitHub REST client. @octokit/rest is deliberately not a dependency: it pulls
// ~7 MB of runtime + types into every install for the handful of calls below.
// @octokit/openapi-types is a devDependency only; `import type` is erased at runtime, so
// these aliases cost users nothing while keeping the response shapes accurate.
type JsonResponse<
  Op extends keyof operations,
  Status extends keyof operations[Op]['responses'],
> = operations[Op]['responses'][Status] extends { content: { 'application/json': infer Body } } ? Body : never

type JsonRequestBody<Op extends keyof operations> = operations[Op] extends { requestBody?: infer Req }
  ? NonNullable<Req> extends { content: { 'application/json': infer Body } }
    ? Body
    : never
  : never

export type GitHubUser = JsonResponse<'users/get-authenticated', 200>
export type GitHubOrg = JsonResponse<'orgs/list-for-authenticated-user', 200>[number]
export type GitHubRepo = JsonResponse<'repos/get', 200>
export type GitHubWebhook = JsonResponse<'repos/list-webhooks', 200>[number]
export type GitHubDeployKey = JsonResponse<'repos/create-deploy-key', 201>
type CreateWebhookBody = JsonRequestBody<'repos/create-webhook'>
type CreateDeployKeyBody = JsonRequestBody<'repos/create-deploy-key'>

export class GitHubApiError extends Error {
  status: number
  json: unknown

  constructor(status: number, body: unknown) {
    super(formatBody(body))
    this.name = 'GitHubApiError'
    this.status = status
    this.json = body
  }
}

// Mirrors the message Octokit built so existing string matching on errors keeps working.
const formatBody = (body: unknown): string => {
  if (typeof body === 'string') return body
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const { message, errors } = body as { message: string; errors?: unknown[] }
    if (Array.isArray(errors)) {
      return `${message}: ${errors.map((error) => JSON.stringify(error)).join(', ')}`
    }
    return message
  }
  return `Unknown error: ${JSON.stringify(body)}`
}

const GITHUB_API_URL = 'https://api.github.com'

export const createGitHubClient = (token: string) => {
  const request = async <T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> => {
    const response = await fetch(`${GITHUB_API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `token ${token}`,
        'User-Agent': 'netlify-cli',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    const text = await response.text()
    let data: unknown = text
    try {
      data = text.length > 0 ? JSON.parse(text) : undefined
    } catch {
      // Non-JSON body (e.g. an HTML error page); keep the raw text for the error message.
    }

    if (!response.ok) {
      throw new GitHubApiError(response.status, data)
    }
    return data as T
  }

  const repoPath = (owner: string, repo: string) => `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`

  return {
    getAuthenticatedUser: () => request<GitHubUser>('GET', '/user'),

    listOrgsForAuthenticatedUser: () => request<GitHubOrg[]>('GET', '/user/orgs?per_page=100'),

    getRepo: ({ owner, repo }: { owner: string; repo: string }) => request<GitHubRepo>('GET', repoPath(owner, repo)),

    createDeployKey: ({ owner, repo, ...body }: { owner: string; repo: string } & CreateDeployKeyBody) =>
      request<GitHubDeployKey>('POST', `${repoPath(owner, repo)}/keys`, body),

    listWebhooks: ({ owner, repo, per_page }: { owner: string; repo: string; per_page: number }) =>
      request<GitHubWebhook[]>('GET', `${repoPath(owner, repo)}/hooks?per_page=${String(per_page)}`),

    createWebhook: ({ owner, repo, ...body }: { owner: string; repo: string } & CreateWebhookBody) =>
      request<GitHubWebhook>('POST', `${repoPath(owner, repo)}/hooks`, body),
  }
}

export type GitHubClient = ReturnType<typeof createGitHubClient>
