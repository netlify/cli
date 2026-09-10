import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { track } from '../../../../src/utils/telemetry/telemetry.js'
import { cliVersion } from '../../../../src/utils/telemetry/utils.js'
import execa from '../../../../src/utils/execa.js'

vi.mock('ci-info', () => ({ isCI: false }))

vi.mock('@netlify/dev-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@netlify/dev-utils')>()),
  getGlobalConfigStore: vi.fn(() =>
    Promise.resolve({ get: (key: string) => (key === 'telemetryDisabled' ? false : 'test-user-1') }),
  ),
}))

vi.mock('../../../../src/utils/execa.js', () => ({ default: vi.fn(() => ({ unref: vi.fn() })) }))

const AGENT_ENV_KEYS = [
  'NETLIFY_AGENT',
  'CODEX_CI',
  'CODEX_VERSION',
  'GEMINI_CLI',
  'COPILOT_CLI',
  'COPILOT_AGENT_SESSION_ID',
  'OPENCODE',
  'OPENCODE_TERMINAL',
  'AGENT_DISPLAY_OUT',
  'AGENT_CONTEXT_OUT',
  'OZ_RUN_ID',
  'WARP_RUN_ID',
  'AI_AGENT',
  'COPILOT_AGENT',
  'CURSOR_AGENT',
  'CLINE_ACTIVE',
  'AGENT',
  'CLAUDE_CODE_CHILD_SESSION',
]

const getTrackedProperties = (): Record<string, unknown> => {
  const { calls } = vi.mocked(execa).mock
  const [, [, optionsJson]] = calls[calls.length - 1] as [string, string[]]
  return (JSON.parse(optionsJson) as { data: { properties: Record<string, unknown> } }).data.properties
}

const getTrackedAgentProperties = () =>
  Object.fromEntries(
    Object.entries(getTrackedProperties()).filter(([key]) => key === 'agent' || key.startsWith('agent_')),
  )

beforeEach(() => {
  vi.clearAllMocks()
  AGENT_ENV_KEYS.forEach((key) => vi.stubEnv(key, undefined))
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('track', () => {
  test('adds the driving agent alongside the existing properties', async () => {
    vi.stubEnv('AI_AGENT', 'claude-code')

    await track('command', { command: 'status' })

    expect(getTrackedProperties()).toMatchObject({ command: 'status', cliVersion })
    expect(getTrackedAgentProperties()).toEqual({ agent: 'claude', agent_source: 'AI_AGENT' })
  })

  test('adds no agent properties when no agent is detected', async () => {
    await track('command', { command: 'status' })

    expect(getTrackedAgentProperties()).toEqual({})
  })

  test('adds the agent version when the agent announces one', async () => {
    vi.stubEnv('AI_AGENT', 'claude-code_2-1-263_agent')

    await track('command', { command: 'status' })

    expect(getTrackedAgentProperties()).toEqual({
      agent: 'claude',
      agent_source: 'AI_AGENT',
      agent_version: '2.1.263',
    })
  })

  test('lists every matched agent when agents are nested', async () => {
    vi.stubEnv('AI_AGENT', 'claude-code')
    vi.stubEnv('CODEX_CI', '1')

    await track('command', { command: 'status' })

    expect(getTrackedAgentProperties()).toEqual({
      agent: 'codex',
      agent_source: 'CODEX_CI',
      agent_markers: ['codex', 'claude'],
    })
  })

  test('reports an unknown AI_AGENT value as other with its raw value', async () => {
    vi.stubEnv('AI_AGENT', 'some-new-tool')

    await track('command', { command: 'status' })

    expect(getTrackedAgentProperties()).toEqual({
      agent: 'other',
      agent_source: 'AI_AGENT',
      agent_other_value: 'some-new-tool',
    })
  })
})
