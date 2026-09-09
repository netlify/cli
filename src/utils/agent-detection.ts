// Only markers an agent product sets on its own count as a signal; never infer from process names, terminals, or the process tree.

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

export type DrivingAgent = {
  name: CanonicalAgentName
  source: string
  version?: string
  markers?: CanonicalAgentName[]
  otherValue?: string
}

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

const nonEmpty = (value: string | undefined): string | undefined => (value ? value : undefined)

const parseAnnouncedName = (raw: string): ParsedAnnouncedName | undefined => {
  const atIndex = raw.indexOf('@')
  const sanitized = sanitizeAnnouncedValue(atIndex === -1 ? raw : raw.slice(0, atIndex))
  if (sanitized === '') {
    return undefined
  }

  const announcedVersion = atIndex === -1 ? undefined : nonEmpty(sanitizeAnnouncedValue(raw.slice(atIndex + 1)))
  const key = sanitized.toLowerCase()

  const exact = ANNOUNCED_NAME_TABLE.get(key)
  if (exact) {
    return { name: exact, version: announcedVersion }
  }

  const withoutAgentSuffix = key.replace(/_agent$/, '')
  const suffixMatch = ANNOUNCED_NAME_TABLE.get(withoutAgentSuffix)
  if (suffixMatch) {
    return { name: suffixMatch, version: announcedVersion }
  }

  const lastUnderscore = withoutAgentSuffix.lastIndexOf('_')
  if (lastUnderscore !== -1) {
    const head = withoutAgentSuffix.slice(0, lastUnderscore)
    const headMatch = ANNOUNCED_NAME_TABLE.get(head)
    if (headMatch) {
      const tail = withoutAgentSuffix.slice(lastUnderscore + 1)
      return { name: headMatch, version: announcedVersion ?? tail.replace(/-/g, '.') }
    }
  }

  return { name: 'other', otherValue: sanitized, version: announcedVersion }
}

type Signal = {
  source: string
  detect: (env: NodeJS.ProcessEnv) => ParsedAnnouncedName | undefined
}

// Precedence, first match wins: NETLIFY_AGENT (explicit, even when unknown); markers only the process
// running the command sets; AI_AGENT (explicit, even when unknown); markers inherited from an agent
// session; runner/task markers such as Warp's last, since the agent inside the run is the more specific answer.
const SIGNALS: Signal[] = [
  {
    source: 'NETLIFY_AGENT',
    detect: (env) => (env.NETLIFY_AGENT === undefined ? undefined : parseAnnouncedName(env.NETLIFY_AGENT)),
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
    detect: (env) =>
      nonEmpty(env.AGENT_DISPLAY_OUT) !== undefined && nonEmpty(env.AGENT_CONTEXT_OUT) !== undefined
        ? { name: 'kiro' }
        : undefined,
  },
  {
    source: 'AI_AGENT',
    detect: (env) => (env.AI_AGENT === undefined ? undefined : parseAnnouncedName(env.AI_AGENT)),
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
  {
    source: 'OZ_RUN_ID',
    detect: (env) => (nonEmpty(env.OZ_RUN_ID) === undefined ? undefined : { name: 'warp' }),
  },
  {
    source: 'WARP_RUN_ID',
    detect: (env) => (nonEmpty(env.WARP_RUN_ID) === undefined ? undefined : { name: 'warp' }),
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

  const [winner] = matches

  const codexVersion = winner.source === 'CODEX_CI' ? nonEmpty(env.CODEX_VERSION) : undefined
  const version = winner.version ?? (codexVersion === undefined ? undefined : sanitizeAnnouncedValue(codexVersion))

  const distinctNames = [...new Set(matches.map((match) => match.name))]

  return {
    name: winner.name,
    source: winner.source,
    ...(version ? { version } : {}),
    ...(distinctNames.length >= 2 ? { markers: distinctNames } : {}),
    ...(winner.name === 'other' ? { otherValue: winner.otherValue ?? '' } : {}),
  }
}
