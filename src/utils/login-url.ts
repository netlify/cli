import { getDrivingAgent } from './agent-detection.js'

// Every other marker's value is a flag, a session or run id, or a path, none of which belong in a URL.
const SOURCES_WITH_ANNOUNCED_VALUE = new Set(['NETLIFY_AGENT', 'AI_AGENT'])

const sanitizeUtmTerm = (raw: string): string => raw.replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 64)

const getUtmTerm = (source: string, env: NodeJS.ProcessEnv): string => {
  const value = SOURCES_WITH_ANNOUNCED_VALUE.has(source) ? env[source] : undefined
  return sanitizeUtmTerm(value ? `${source}:${value}` : source)
}

export const buildAuthorizeUrl = (ticketId: string, env: NodeJS.ProcessEnv = process.env): string => {
  const webUI = env.NETLIFY_WEB_UI || 'https://app.netlify.com'
  const params = new URLSearchParams({
    response_type: 'ticket',
    ticket: ticketId,
    utm_source: 'cli',
    utm_campaign: 'integrations',
  })

  const agent = getDrivingAgent(env)
  if (agent) {
    params.set('utm_content', agent.name)
    params.set('utm_term', getUtmTerm(agent.source, env))
  }

  return `${webUI}/authorize?${params.toString()}`
}
