// This type lives in a separate file to prevent import cycles.

import type { BaseOptionValues } from '../base-command.js'

export type AgentsOptionValues = BaseOptionValues

export type AgentsCreateOptionValues = BaseOptionValues & {
  agent?: string
  branch?: string
  json?: boolean
  model?: string
  project?: string
  prompt?: string
}

export type AgentsListOptionValues = BaseOptionValues & {
  json?: boolean
  project?: string
  status?: string
}

export type AgentsShowOptionValues = BaseOptionValues & {
  json?: boolean
  project?: string
}

export type AgentsStopOptionValues = BaseOptionValues & {
  json?: boolean
  project?: string
}
