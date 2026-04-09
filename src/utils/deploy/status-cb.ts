// TODO(serhalp): This is alternatingly called "event", "status", and "progress". Standardize.
export interface DeployEvent {
  type: string
  msg: string
  phase: 'start' | 'progress' | 'error' | 'stop'
}

export type StatusCallback = (status: DeployEvent) => void
