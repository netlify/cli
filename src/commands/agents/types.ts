import type { AgentState, ListStatusFilter, SessionState, SessionMode, AvailableAgent } from './constants.js'

export interface AgentConfig {
  agent?: AvailableAgent
  model?: string
  [key: string]: unknown
}

export interface AgentRunnerUser {
  id: string
  full_name?: string
  email?: string
  avatar_url?: string
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
  base_deploy_id?: string
  sha?: string

  pr_url?: string
  pr_branch?: string
  pr_state?: string
  pr_number?: number
  pr_is_being_created?: boolean
  pr_error?: string

  merge_commit_sha?: string
  merge_commit_error?: string
  merge_commit_is_being_created?: boolean

  attached_file_keys?: string[]
  active_session_created_at?: string
  last_session_created_at?: string
  has_result_diff?: boolean

  latest_session_deploy_id?: string
  latest_session_deploy_url?: string
  latest_session_deploy_screenshot_url?: string
  latest_session_state?: SessionState
  latest_session_mode?: SessionMode
  latest_session_is_published?: boolean

  needs_git_sync?: boolean
  rebase_available?: boolean
  merge_target_available?: boolean

  user?: AgentRunnerUser
  contributors?: AgentRunnerUser[]
}

export interface AgentRunnerSessionUsage {
  total_input_tokens?: number
  total_output_tokens?: number
  total_cached_input_tokens?: number
  total_cached_output_tokens?: number
  total_tokens?: number
  total_input_microcents?: number
  total_output_microcents?: number
  total_cached_input_microcents?: number
  total_cached_output_microcents?: number
  total_tool_calls_microcents?: number
  total_credits_cost?: number
}

export interface AgentRunnerSessionStep {
  title?: string
  message?: string
}

export interface AgentRunnerSession {
  id: string
  agent_runner_id: string
  dev_server_id?: string
  state: SessionState
  mode?: SessionMode
  created_at: string
  updated_at: string
  done_at?: string
  title?: string
  current_task?: string
  prompt: string
  agent_config?: AgentConfig
  result?: string
  result_diff?: string
  cumulative_diff?: string
  duration?: number
  steps?: AgentRunnerSessionStep[]
  user?: AgentRunnerUser
  attached_file_keys?: string[]
  result_zip_file_name?: string
  is_published?: boolean
  is_discarded?: boolean
  commit_sha?: string
  source_session_id?: string
  deploy_id?: string
  deploy_url?: string
  usage?: AgentRunnerSessionUsage
  credit_limit_exceeded?: boolean
  metadata?: Record<string, unknown>
}

export interface CreateAgentRunnerPayload {
  prompt: string
  agent: AvailableAgent
  model?: string
  branch?: string
  deploy_id?: string
  parent_agent_runner_id?: string
  file_keys?: string[]
}

export interface CreateAgentRunnerSessionPayload {
  prompt: string
  agent?: AvailableAgent
  model?: string
  file_keys?: string[]
}

export interface ListAgentRunnersFilters {
  state?: ListStatusFilter
  branch?: string
  result_branch?: string
  user_id?: string
  title?: string
  from?: number
  to?: number
  page?: number
  per_page?: number
}

export interface ListAgentRunnerSessionsFilters {
  state?: SessionState
  from?: number
  to?: number
  order_by?: 'asc' | 'desc'
  include_discarded?: boolean
  page?: number
  per_page?: number
}

export interface DiffParams {
  page?: number
  per_page?: number
  strip_binary?: boolean
}

export interface PaginatedResult<T> {
  data: T
  total?: number
  page: number
  perPage: number
  hasNext: boolean
}

export interface UploadUrlResponse {
  upload_url: string
  file_key: string
}

export interface DeleteUrlResponse {
  delete_url: string
  file_key: string
}

export interface APIError {
  status: number
  message: string
  error?: string
}

export interface AiGatewayProviderInfo {
  token_env_var: string
  url_env_var: string
  models: string[]
}

export interface AiGatewayProvidersResponse {
  providers: Partial<Record<string, AiGatewayProviderInfo>>
}
