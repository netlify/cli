// Only markers an agent product sets on its own count as a signal; never infer from process names, terminals, or the process tree.

export type DrivingAgent = {
  name: string
  source: string
  version?: string
  markers?: string[]
  otherValue?: string
}

export const CANONICAL_AGENT_NAMES = [
  'claude',
  'codex',
  'copilot',
  'gemini',
  'cursor',
  'opencode',
  'kiro',
  'cline',
  'amp',
  'warp',
  'claudeai',
  'chatgpt',
  'other',
] as const

export type CanonicalAgentName = (typeof CANONICAL_AGENT_NAMES)[number]

const ANNOUNCED_NAME_TABLE = new Map<string, CanonicalAgentName>([
  ...CANONICAL_AGENT_NAMES.map((name) => [name, name] as const),
  ['claude-code', 'claude'],
  ['claude-ai', 'claudeai'],
  ['github_copilot_vscode_agent', 'copilot'],
])

type ParsedAnnouncedName = {
  name: CanonicalAgentName
  version?: string
  otherValue?: string
}

const sanitizeAnnouncedValue = (raw: string): string => raw.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 64)

const parseAnnouncedName = (raw: string): ParsedAnnouncedName => {
  const sanitized = sanitizeAnnouncedValue(raw)

  const exact = ANNOUNCED_NAME_TABLE.get(sanitized)
  if (exact) {
    return { name: exact }
  }

  const withoutAgentSuffix = sanitized.replace(/_agent$/, '')
  const suffixMatch = ANNOUNCED_NAME_TABLE.get(withoutAgentSuffix)
  if (suffixMatch) {
    return { name: suffixMatch }
  }

  const lastUnderscore = withoutAgentSuffix.lastIndexOf('_')
  if (lastUnderscore !== -1) {
    const head = withoutAgentSuffix.slice(0, lastUnderscore)
    const headMatch = ANNOUNCED_NAME_TABLE.get(head)
    if (headMatch) {
      const tail = withoutAgentSuffix.slice(lastUnderscore + 1)
      return { name: headMatch, version: tail.replace(/-/g, '.') }
    }
  }

  return { name: 'other', otherValue: sanitized }
}

const nonEmpty = (value: string | undefined): string | undefined => (value ? value : undefined)

type Signal = {
  source: string
  detect: (env: NodeJS.ProcessEnv) => ParsedAnnouncedName | undefined
}

const SIGNALS: Signal[] = [
  {
    source: 'NETLIFY_AGENT',
    detect: (env) => {
      const value = nonEmpty(env.NETLIFY_AGENT)
      return value === undefined ? undefined : parseAnnouncedName(value)
    },
  },
  {
    source: 'CODEX_CI',
    detect: (env) => (env.CODEX_CI === '1' ? { name: 'codex' } : undefined),
  },
  {
    source: 'GEMINI_CLI',
    detect: (env) => (env.GEMINI_CLI === '1' ? { name: 'gemini' } : undefined),
  },
  {
    source: 'COPILOT_CLI',
    detect: (env) => (env.COPILOT_CLI === '1' ? { name: 'copilot' } : undefined),
  },
  {
    source: 'COPILOT_AGENT_SESSION_ID',
    detect: (env) => (nonEmpty(env.COPILOT_AGENT_SESSION_ID) === undefined ? undefined : { name: 'copilot' }),
  },
  {
    source: 'OPENCODE',
    detect: (env) =>
      env.OPENCODE === '1' && nonEmpty(env.OPENCODE_TERMINAL) === undefined ? { name: 'opencode' } : undefined,
  },
  {
    source: 'AGENT_DISPLAY_OUT',
    detect: (env) => (nonEmpty(env.AGENT_DISPLAY_OUT) === undefined ? undefined : { name: 'kiro' }),
  },
  {
    source: 'AGENT_CONTEXT_OUT',
    detect: (env) => (nonEmpty(env.AGENT_CONTEXT_OUT) === undefined ? undefined : { name: 'kiro' }),
  },
  {
    source: 'OZ_RUN_ID',
    detect: (env) => (nonEmpty(env.OZ_RUN_ID) === undefined ? undefined : { name: 'warp' }),
  },
  {
    source: 'WARP_RUN_ID',
    detect: (env) => (nonEmpty(env.WARP_RUN_ID) === undefined ? undefined : { name: 'warp' }),
  },
  {
    source: 'AI_AGENT',
    detect: (env) => {
      const value = nonEmpty(env.AI_AGENT)
      return value === undefined ? undefined : parseAnnouncedName(value)
    },
  },
  {
    source: 'COPILOT_AGENT',
    detect: (env) => (env.COPILOT_AGENT === '1' ? { name: 'copilot' } : undefined),
  },
  {
    source: 'CURSOR_AGENT',
    detect: (env) => (env.CURSOR_AGENT === '1' ? { name: 'cursor' } : undefined),
  },
  {
    source: 'CLINE_ACTIVE',
    detect: (env) => (env.CLINE_ACTIVE === 'true' ? { name: 'cline' } : undefined),
  },
  {
    source: 'AGENT',
    detect: (env) => (env.AGENT === 'amp' ? { name: 'amp' } : undefined),
  },
  {
    source: 'CLAUDE_CODE_CHILD_SESSION',
    detect: (env) => (env.CLAUDE_CODE_CHILD_SESSION === '1' ? { name: 'claude' } : undefined),
  },
]

type SignalMatch = { source: string } & ParsedAnnouncedName

export const getDrivingAgent = (env: NodeJS.ProcessEnv = process.env): DrivingAgent | undefined => {
  const matches: SignalMatch[] = []

  for (const signal of SIGNALS) {
    const result = signal.detect(env)
    if (result) {
      matches.push({ source: signal.source, ...result })
    }
  }

  if (matches.length === 0) {
    return undefined
  }

  const [first] = matches
  const winner = first.source === 'NETLIFY_AGENT' ? first : (matches.find((match) => match.name !== 'other') ?? first)

  const version =
    winner.source === 'AI_AGENT'
      ? winner.version
      : winner.source === 'CODEX_CI'
        ? nonEmpty(env.CODEX_VERSION)
        : undefined

  const distinctNames = [...new Set(matches.map((match) => match.name))]

  return {
    name: winner.name,
    source: winner.source,
    ...(version ? { version } : {}),
    ...(distinctNames.length >= 2 ? { markers: distinctNames } : {}),
    ...(winner.name === 'other' ? { otherValue: winner.otherValue ?? '' } : {}),
  }
}
