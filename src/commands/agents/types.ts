import type { AgentState, SessionState, AvailableAgent } from './constants.js'

export interface AgentConfig {
  agent?: AvailableAgent
  model?: string
  [key: string]: unknown
}

export interface AgentRunner {
  id: string
  site_id?: string
  parent_agent_runner_id?: string
  state?: AgentState
  created_at: string
  updated_at: string
  done_at?: string
  title?: string
  branch?: string
  result_branch?: string
  current_task?: string
  user?: {
    id: string
    full_name?: string
  }
}

export interface AgentRunnerSession {
  id: string
  agent_runner_id: string
  dev_server_id?: string
  state: SessionState
  created_at: string
  updated_at: string
  done_at?: string
  title?: string
  prompt: string
  agent_config?: AgentConfig
  result?: string
  result_diff?: string
  duration?: number
  steps?: {
    title?: string
    message?: string
  }[]
}

export interface APIError {
  status: number
  message: string
  error?: string
}
