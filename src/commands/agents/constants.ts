import { chalk } from '../../utils/command-helpers.js'

/**
 * Available agent types for task creation
 */
export const AVAILABLE_AGENTS = [
  { name: 'Claude', value: 'claude' },
  { name: 'Codex', value: 'codex' },
  { name: 'Gemini', value: 'gemini' },
] as const

/**
 * Valid agent task states
 */
export const AGENT_STATES = ['new', 'running', 'done', 'error', 'cancelled', 'archived'] as const

/**
 * Valid agent session states
 */
export const SESSION_STATES = ['new', 'running', 'done', 'error', 'cancelled'] as const

/**
 * Color mapping for agent task status display
 */
export const STATUS_COLORS = {
  new: chalk.blue,
  running: chalk.yellow,
  done: chalk.green,
  error: chalk.red,
  cancelled: chalk.gray,
  archived: chalk.dim,
} as const

/**
 * Type definitions extracted from constants
 */
export type AgentState = (typeof AGENT_STATES)[number]
export type SessionState = (typeof SESSION_STATES)[number]
export type AvailableAgent = (typeof AVAILABLE_AGENTS)[number]['value']
