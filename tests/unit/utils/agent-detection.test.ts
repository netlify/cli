import { expect, test, vi } from 'vitest'

import { CANONICAL_AGENT_NAMES, getDrivingAgent } from '../../../src/utils/agent-detection.js'

test('resolves NETLIFY_AGENT to the matching canonical name', () => {
  expect(getDrivingAgent({ NETLIFY_AGENT: 'codex' })).toEqual({ name: 'codex', source: 'NETLIFY_AGENT' })
})

test('resolves CODEX_CI without CODEX_VERSION and omits version', () => {
  expect(getDrivingAgent({ CODEX_CI: '1' })).toEqual({ name: 'codex', source: 'CODEX_CI' })
})

test('adds version from CODEX_VERSION when CODEX_CI matches', () => {
  expect(getDrivingAgent({ CODEX_CI: '1', CODEX_VERSION: '1.2.3' })).toEqual({
    name: 'codex',
    source: 'CODEX_CI',
    version: '1.2.3',
  })
})

test('resolves GEMINI_CLI', () => {
  expect(getDrivingAgent({ GEMINI_CLI: '1' })).toEqual({ name: 'gemini', source: 'GEMINI_CLI' })
})

test('resolves COPILOT_CLI', () => {
  expect(getDrivingAgent({ COPILOT_CLI: '1' })).toEqual({ name: 'copilot', source: 'COPILOT_CLI' })
})

test('resolves COPILOT_AGENT_SESSION_ID', () => {
  expect(getDrivingAgent({ COPILOT_AGENT_SESSION_ID: 'session-123' })).toEqual({
    name: 'copilot',
    source: 'COPILOT_AGENT_SESSION_ID',
  })
})

test('resolves OPENCODE when OPENCODE_TERMINAL is unset', () => {
  expect(getDrivingAgent({ OPENCODE: '1' })).toEqual({ name: 'opencode', source: 'OPENCODE' })
})

test('resolves AGENT_DISPLAY_OUT to kiro without surfacing its value', () => {
  expect(getDrivingAgent({ AGENT_DISPLAY_OUT: '/tmp/agent-display-output.json' })).toEqual({
    name: 'kiro',
    source: 'AGENT_DISPLAY_OUT',
  })
})

test('resolves AGENT_CONTEXT_OUT to kiro', () => {
  expect(getDrivingAgent({ AGENT_CONTEXT_OUT: '/tmp/agent-context-output.json' })).toEqual({
    name: 'kiro',
    source: 'AGENT_CONTEXT_OUT',
  })
})

test('parses AI_AGENT claude-code_2-1-263_agent into claude with version 2.1.263', () => {
  expect(getDrivingAgent({ AI_AGENT: 'claude-code_2-1-263_agent' })).toEqual({
    name: 'claude',
    source: 'AI_AGENT',
    version: '2.1.263',
  })
})

test('parses AI_AGENT github_copilot_vscode_agent into copilot without version', () => {
  expect(getDrivingAgent({ AI_AGENT: 'github_copilot_vscode_agent' })).toEqual({
    name: 'copilot',
    source: 'AI_AGENT',
  })
})

test('resolves COPILOT_AGENT', () => {
  expect(getDrivingAgent({ COPILOT_AGENT: '1' })).toEqual({ name: 'copilot', source: 'COPILOT_AGENT' })
})

test('resolves CURSOR_AGENT', () => {
  expect(getDrivingAgent({ CURSOR_AGENT: '1' })).toEqual({ name: 'cursor', source: 'CURSOR_AGENT' })
})

test('resolves CLINE_ACTIVE', () => {
  expect(getDrivingAgent({ CLINE_ACTIVE: 'true' })).toEqual({ name: 'cline', source: 'CLINE_ACTIVE' })
})

test('resolves AGENT=amp exactly', () => {
  expect(getDrivingAgent({ AGENT: 'amp' })).toEqual({ name: 'amp', source: 'AGENT' })
})

test('resolves CLAUDE_CODE_CHILD_SESSION', () => {
  expect(getDrivingAgent({ CLAUDE_CODE_CHILD_SESSION: '1' })).toEqual({
    name: 'claude',
    source: 'CLAUDE_CODE_CHILD_SESSION',
  })
})

test('a single match omits markers', () => {
  const result = getDrivingAgent({ CURSOR_AGENT: '1' })
  expect(result).toEqual({ name: 'cursor', source: 'CURSOR_AGENT' })
  expect(result?.markers).toBeUndefined()
})

test('NETLIFY_AGENT overrides every other signal and lists all matched names as markers', () => {
  expect(
    getDrivingAgent({
      CODEX_CI: '1',
      GEMINI_CLI: '1',
      COPILOT_CLI: '1',
      COPILOT_AGENT_SESSION_ID: 'session-123',
      OPENCODE: '1',
      AGENT_DISPLAY_OUT: '/tmp/agent-display-output.json',
      AGENT_CONTEXT_OUT: '/tmp/agent-context-output.json',
      AI_AGENT: 'claude-code_2-1-263_agent',
      COPILOT_AGENT: '1',
      CURSOR_AGENT: '1',
      CLINE_ACTIVE: 'true',
      AGENT: 'amp',
      CLAUDE_CODE_CHILD_SESSION: '1',
      NETLIFY_AGENT: 'chatgpt',
    }),
  ).toEqual({
    name: 'chatgpt',
    source: 'NETLIFY_AGENT',
    markers: ['chatgpt', 'codex', 'gemini', 'copilot', 'opencode', 'kiro', 'claude', 'cursor', 'cline', 'amp'],
  })
})

test('nests AI_AGENT under a higher-priority CODEX_CI match', () => {
  expect(
    getDrivingAgent({
      AI_AGENT: 'claude-code_2-1-263_agent',
      CODEX_CI: '1',
    }),
  ).toEqual({
    name: 'codex',
    source: 'CODEX_CI',
    markers: ['codex', 'claude'],
  })
})

test('unknown AI_AGENT resolves to other with otherValue', () => {
  expect(getDrivingAgent({ AI_AGENT: 'some-new-tool_1-0_agent' })).toEqual({
    name: 'other',
    source: 'AI_AGENT',
    otherValue: 'some-new-tool_1-0_agent',
  })
})

test('a recognized name beats an other match but still lists it in markers', () => {
  expect(
    getDrivingAgent({
      AI_AGENT: 'some-new-tool_1-0_agent',
      CURSOR_AGENT: '1',
    }),
  ).toEqual({
    name: 'cursor',
    source: 'CURSOR_AGENT',
    markers: ['other', 'cursor'],
  })
})

test('an unknown, oversized NETLIFY_AGENT value is sanitized and capped at 64 characters', () => {
  const raw = `${'x'.repeat(70)} disallowed/chars!!!`
  const result = getDrivingAgent({ NETLIFY_AGENT: raw })

  expect(result).toEqual({
    name: 'other',
    source: 'NETLIFY_AGENT',
    otherValue: 'x'.repeat(64),
  })
  expect(result?.otherValue).toHaveLength(64)
})

test.each(['constructor', '__proto__', 'toString'])('%s does not resolve via the Object prototype chain', (key) => {
  expect(getDrivingAgent({ NETLIFY_AGENT: key })).toEqual({
    name: 'other',
    source: 'NETLIFY_AGENT',
    otherValue: key,
  })
  expect(getDrivingAgent({ AI_AGENT: key })).toEqual({
    name: 'other',
    source: 'AI_AGENT',
    otherValue: key,
  })
})

test('NETLIFY_AGENT=constructor_1-0_agent does not resolve constructor via the split-at-last-underscore path', () => {
  expect(getDrivingAgent({ NETLIFY_AGENT: 'constructor_1-0_agent' })).toEqual({
    name: 'other',
    source: 'NETLIFY_AGENT',
    otherValue: 'constructor_1-0_agent',
  })
})

test('AGENT=1 alone matches nothing', () => {
  expect(getDrivingAgent({ AGENT: '1' })).toBeUndefined()
})

test('AGENT=true alone matches nothing', () => {
  expect(getDrivingAgent({ AGENT: 'true' })).toBeUndefined()
})

test('OPENCODE with OPENCODE_TERMINAL set matches nothing', () => {
  expect(getDrivingAgent({ OPENCODE: '1', OPENCODE_TERMINAL: '1' })).toBeUndefined()
})

test('an empty string value is treated as unset', () => {
  expect(getDrivingAgent({ CODEX_CI: '' })).toBeUndefined()
})

test('an env of only ignored variables matches nothing', () => {
  expect(
    getDrivingAgent({
      CLAUDECODE: '1',
      CURSOR_TRACE_ID: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      CURSOR_CLI: '1',
      TERM_PROGRAM: 'iTerm.app',
      ZED_TERM: 'true',
      CODEX_SESSION_ID: 'sess_abc123',
      CODEX_THREAD_ID: 'thread_xyz789',
      AGENT_SESSION_ID: 'agent-session-001',
      OR_APP_NAME: 'OpenRouter',
      REPLIT_AGENT: '1',
    }),
  ).toBeUndefined()
})

test('an empty env matches nothing', () => {
  expect(getDrivingAgent({})).toBeUndefined()
})

test('falls back to process.env when no argument is given', () => {
  const signalKeys = [
    'NETLIFY_AGENT',
    'CODEX_CI',
    'GEMINI_CLI',
    'COPILOT_CLI',
    'COPILOT_AGENT_SESSION_ID',
    'OPENCODE',
    'OPENCODE_TERMINAL',
    'AGENT_DISPLAY_OUT',
    'AGENT_CONTEXT_OUT',
    'AI_AGENT',
    'COPILOT_AGENT',
    'CURSOR_AGENT',
    'CLINE_ACTIVE',
    'AGENT',
    'CLAUDE_CODE_CHILD_SESSION',
  ]

  try {
    signalKeys.forEach((key) => vi.stubEnv(key, undefined))
    vi.stubEnv('GEMINI_CLI', '1')

    expect(getDrivingAgent()).toEqual({ name: 'gemini', source: 'GEMINI_CLI' })
  } finally {
    vi.unstubAllEnvs()
  }
})

test('CANONICAL_AGENT_NAMES has no duplicates and only lowercase letters', () => {
  const uniqueNames = new Set(CANONICAL_AGENT_NAMES)
  expect(uniqueNames.size).toBe(CANONICAL_AGENT_NAMES.length)

  CANONICAL_AGENT_NAMES.forEach((name) => {
    expect(name).toMatch(/^[a-z]+$/)
  })
})
