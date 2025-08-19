import { AVAILABLE_AGENTS, STATUS_COLORS } from './constants.js'
import { chalk } from '../../utils/command-helpers.js'

export const formatStatus = (status: string): string => {
  const colorFn = status in STATUS_COLORS ? STATUS_COLORS[status as keyof typeof STATUS_COLORS] : chalk.white
  return colorFn(status.toUpperCase())
}

export const validatePrompt = (input: string): boolean | string => {
  if (!input || input.trim().length === 0) {
    return 'Please provide a prompt for the agent'
  }
  if (input.trim().length < 10) {
    return 'Please provide a more detailed prompt (at least 10 characters)'
  }
  return true
}

export const validateAgent = (agent: string): boolean | string => {
  const validAgents = AVAILABLE_AGENTS.map((a) => a.value) as string[]
  if (!validAgents.includes(agent)) {
    return `Invalid agent. Available agents: ${validAgents.join(', ')}`
  }
  return true
}

export { AVAILABLE_AGENTS }
