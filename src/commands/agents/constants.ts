import { chalk } from '../../utils/command-helpers.js'

export const AVAILABLE_AGENTS = [
  { name: 'Claude', value: 'claude' },
  { name: 'Codex', value: 'codex' },
  { name: 'Gemini', value: 'gemini' },
] as const

export const AGENT_TO_PROVIDER = {
  claude: 'anthropic',
  codex: 'openai',
  gemini: 'gemini',
} as const

export const AGENT_STATES = ['new', 'running', 'done', 'error', 'cancelled', 'archived'] as const
export const SESSION_STATES = ['new', 'running', 'done', 'error', 'cancelled'] as const

export const SESSION_MODES = [
  'normal',
  'redeploy',
  'rebase',
  'git_sync',
  'create',
  'ask',
  'conflict_resolution',
] as const

export const LIST_STATUS_FILTERS = ['running', 'done', 'error', 'archived'] as const

export const STATUS_COLORS = {
  new: chalk.blue,
  running: chalk.yellow,
  done: chalk.green,
  error: chalk.red,
  cancelled: chalk.gray,
  archived: chalk.dim,
} as const

export const TERMINAL_AGENT_STATES = ['done', 'error', 'cancelled', 'archived'] as const
export const TERMINAL_SESSION_STATES = ['done', 'error', 'cancelled'] as const

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024

export type AgentState = (typeof AGENT_STATES)[number]
export type SessionState = (typeof SESSION_STATES)[number]
export type SessionMode = (typeof SESSION_MODES)[number]
export type ListStatusFilter = (typeof LIST_STATUS_FILTERS)[number]
export type AvailableAgent = (typeof AVAILABLE_AGENTS)[number]['value']
