export interface DeploySourceFields {
  deploy_source: string
  agent_runner_id?: string
  agent_runner_session_id?: string
}

export const getDeploySource = (): string => process.env.NETLIFY_DEPLOY_SOURCE || 'cli'

export const getDeploySourceFields = (): DeploySourceFields => {
  const agentRunnerId = process.env.NETLIFY_AGENT_RUNNER_ID
  const agentRunnerSessionId = process.env.NETLIFY_AGENT_RUNNER_SESSION_ID

  return {
    deploy_source: getDeploySource(),
    ...(agentRunnerId ? { agent_runner_id: agentRunnerId } : {}),
    ...(agentRunnerSessionId ? { agent_runner_session_id: agentRunnerSessionId } : {}),
  }
}
