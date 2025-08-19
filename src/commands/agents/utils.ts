import { AVAILABLE_AGENTS } from './constants.js'

/**
 * Validates a prompt string for agent task creation
 * @param input - The prompt string to validate
 * @returns true if valid, error message string if invalid
 */
export const validatePrompt = (input: string): boolean | string => {
  if (!input || input.trim().length === 0) {
    return 'Please provide a prompt for the agent'
  }
  if (input.trim().length < 10) {
    return 'Please provide a more detailed prompt (at least 10 characters)'
  }
  return true
}

/**
 * Validates that an agent type is supported
 * @param agent - The agent type to validate
 * @returns true if valid, error message string if invalid
 */
export const validateAgent = (agent: string): boolean | string => {
  const validAgents = AVAILABLE_AGENTS.map((a) => a.value) as string[]
  if (!validAgents.includes(agent)) {
    return `Invalid agent. Available agents: ${validAgents.join(', ')}`
  }
  return true
}

export { AVAILABLE_AGENTS }
