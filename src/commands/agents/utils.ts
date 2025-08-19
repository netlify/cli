import { AVAILABLE_AGENTS, STATUS_COLORS } from './constants.js'
import { chalk } from '../../utils/command-helpers.js'

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleString()
}

export const formatDuration = (startTime: string, endTime?: string): string => {
  const start = new Date(startTime)
  const end = endTime ? new Date(endTime) : new Date()
  const duration = end.getTime() - start.getTime()

  const hours = Math.floor(duration / 3600000)
  const minutes = Math.floor((duration % 3600000) / 60000)
  const seconds = Math.floor((duration % 60000) / 1000)

  if (hours > 0) {
    return `${hours.toString()}h ${minutes.toString()}m ${seconds.toString()}s`
  }
  if (minutes > 0) {
    return `${minutes.toString()}m ${seconds.toString()}s`
  }
  return `${seconds.toString()}s`
}

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

export const getAgentName = (agent: string): string => {
  const entry = AVAILABLE_AGENTS.find((a) => a.value === agent)
  return entry ? entry.name : agent
}
