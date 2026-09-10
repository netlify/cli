import { getRequestUserAgent } from './user-agent.js'

type FetchInput = Parameters<typeof fetch>[0]

const withUserAgent = (input: FetchInput, init?: RequestInit): RequestInit => {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
  headers.set('User-Agent', getRequestUserAgent())
  return { ...init, headers }
}

export const netlifyFetch: typeof fetch = (input, init) => fetch(input, withUserAgent(input, init))

export const netlifyFetchForOrigin = (origin: string): typeof fetch => {
  const netlifyOrigin = new URL(origin).origin
  return (input, init) => {
    const { origin: requestOrigin } = new URL(input instanceof Request ? input.url : input)
    return requestOrigin === netlifyOrigin ? netlifyFetch(input, init) : fetch(input, init)
  }
}
