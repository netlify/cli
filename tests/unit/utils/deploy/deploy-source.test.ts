import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { getDeploySourceFields } from '../../../../src/utils/deploy/deploy-source.js'

beforeEach(() => {
  vi.stubEnv('NETLIFY_DEPLOY_SOURCE', undefined)
  vi.stubEnv('NETLIFY_AGENT_RUNNER_ID', undefined)
  vi.stubEnv('NETLIFY_AGENT_RUNNER_SESSION_ID', undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

test('defaults the deploy source to `cli`', () => {
  expect(getDeploySourceFields()).toEqual({ deploy_source: 'cli' })
})

test('honors NETLIFY_DEPLOY_SOURCE', () => {
  vi.stubEnv('NETLIFY_DEPLOY_SOURCE', 'agent_runner')

  expect(getDeploySourceFields()).toEqual({ deploy_source: 'agent_runner' })
})

test('forwards the agent runner ids', () => {
  vi.stubEnv('NETLIFY_DEPLOY_SOURCE', 'agent_runner')
  vi.stubEnv('NETLIFY_AGENT_RUNNER_ID', 'runner-123')
  vi.stubEnv('NETLIFY_AGENT_RUNNER_SESSION_ID', 'session-456')

  expect(getDeploySourceFields()).toEqual({
    deploy_source: 'agent_runner',
    agent_runner_id: 'runner-123',
    agent_runner_session_id: 'session-456',
  })
})

test('omits the session id when only the runner id is set', () => {
  vi.stubEnv('NETLIFY_AGENT_RUNNER_ID', 'runner-123')

  expect(getDeploySourceFields()).toEqual({ deploy_source: 'cli', agent_runner_id: 'runner-123' })
})

test('omits empty agent runner ids', () => {
  vi.stubEnv('NETLIFY_AGENT_RUNNER_ID', '')
  vi.stubEnv('NETLIFY_AGENT_RUNNER_SESSION_ID', '')

  expect(getDeploySourceFields()).toEqual({ deploy_source: 'cli' })
})
