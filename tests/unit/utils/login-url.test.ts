import { expect, test } from 'vitest'

import { buildAuthorizeUrl } from '../../../src/utils/login-url.js'

const paramsFor = (env: NodeJS.ProcessEnv) => new URL(buildAuthorizeUrl('ticket-123', env)).searchParams

test('tags the URL with only the CLI source and campaign when no agent is detected', () => {
  expect(buildAuthorizeUrl('ticket-123', {})).toBe(
    'https://app.netlify.com/authorize?response_type=ticket&ticket=ticket-123&utm_source=cli&utm_campaign=integrations',
  )
})

test('adds the agent name and the deciding variable with its value', () => {
  const params = paramsFor({ AI_AGENT: 'claude-code_2-1-259_agent' })

  expect(params.get('utm_source')).toBe('cli')
  expect(params.get('utm_campaign')).toBe('integrations')
  expect(params.get('utm_content')).toBe('claude')
  expect(params.get('utm_term')).toBe('AI_AGENT:claude-code_2-1-259_agent')
})

test('reports an unrecognized agent as other and keeps its raw value in utm_term', () => {
  const params = paramsFor({ AI_AGENT: 'brand-new-agent' })

  expect(params.get('utm_content')).toBe('other')
  expect(params.get('utm_term')).toBe('AI_AGENT:brand-new-agent')
})

test('keeps the name@version boundary of an announced value', () => {
  const params = paramsFor({ AI_AGENT: 'codex@1.2.3' })

  expect(params.get('utm_content')).toBe('codex')
  expect(params.get('utm_term')).toBe('AI_AGENT:codex@1.2.3')
})

test('includes the NETLIFY_AGENT value in utm_term', () => {
  const params = paramsFor({ NETLIFY_AGENT: 'claude-code' })

  expect(params.get('utm_content')).toBe('claude')
  expect(params.get('utm_term')).toBe('NETLIFY_AGENT:claude-code')
})

test('sends only the variable name for a presence-only marker', () => {
  const params = paramsFor({ CODEX_CI: '1' })

  expect(params.get('utm_content')).toBe('codex')
  expect(params.get('utm_term')).toBe('CODEX_CI')
})

test('never puts a session id in utm_term', () => {
  expect(paramsFor({ COPILOT_AGENT_SESSION_ID: 'session-abc-123' }).get('utm_term')).toBe('COPILOT_AGENT_SESSION_ID')
})

test('strips characters outside the allowed set from utm_term', () => {
  expect(paramsFor({ AI_AGENT: 'my agent/v1!' }).get('utm_term')).toBe('AI_AGENT:myagentv1')
})

test('caps utm_term at 64 characters', () => {
  expect(paramsFor({ AI_AGENT: 'x'.repeat(100) }).get('utm_term')).toBe(`AI_AGENT:${'x'.repeat(55)}`)
})

test('uses NETLIFY_WEB_UI as the base when set', () => {
  expect(buildAuthorizeUrl('ticket-123', { NETLIFY_WEB_UI: 'https://custom.netlify.com' })).toMatch(
    /^https:\/\/custom\.netlify\.com\/authorize\?response_type=ticket&ticket=ticket-123&/,
  )
})
