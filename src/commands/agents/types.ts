export interface AgentRunner {
  id: string
  site_id?: string
  parent_agent_runner_id?: string
  state?: 'new' | 'running' | 'done' | 'error' | 'cancelled' | 'archived'
  created_at: string
  updated_at: string
  done_at?: string
  title?: string
  branch?: string
  result_branch?: string
  current_task?: string
  agent?: string
  model?: string
  user?: {
    id: string
    email: string
    full_name?: string
  }
}

export interface AgentRunnerSession {
  id: string
  agent_runner_id: string
  dev_server_id?: string
  state: 'new' | 'running' | 'done' | 'error' | 'cancelled'
  created_at: string
  updated_at: string
  done_at?: string
  title?: string
  prompt: string
  agent_config?: Record<string, unknown>
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
