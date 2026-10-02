const GITHUB_API_URL = 'https://api.github.com'

export class GitHubAPIError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'GitHubAPIError'
    this.status = status
  }
}

export interface GitHubUser {
  login: string
}

export interface GitHubRepo {
  id: number
  full_name: string
  default_branch: string
}

export interface GitHubWebhook {
  config: { url?: string }
}

interface GitHubErrorBody {
  message?: string
  errors?: unknown[]
}

const readErrorMessage = async (response: Response): Promise<string> => {
  let body: GitHubErrorBody
  try {
    body = (await response.json()) as GitHubErrorBody
  } catch {
    return response.statusText
  }
  const message = body.message ?? response.statusText
  // Matches the format Octokit used, which callers rely on to detect specific validation errors.
  return body.errors?.length ? `${message}: ${body.errors.map((error) => JSON.stringify(error)).join(', ')}` : message
}

export const requestGitHub = async <T>(
  token: string,
  method: string,
  path: string,
  { query, body }: { query?: Record<string, string | number>; body?: unknown } = {},
): Promise<T> => {
  const url = new URL(path, GITHUB_API_URL)
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, String(value))
  }

  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `token ${token}`,
      'User-Agent': 'netlify-cli',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) {
    throw new GitHubAPIError(await readErrorMessage(response), response.status)
  }

  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}
