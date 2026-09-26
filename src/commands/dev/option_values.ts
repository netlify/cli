// This type lives in a separate file to prevent import cycles.

import type { BaseOptionValues } from '../base-command.js'

export type DevOptionValues = BaseOptionValues & {
  command?: string
  context?: string
  country?: string
  dir?: string
  edgeInspect?: string | true
  edgeInspectBrk?: string | true
  framework?: string
  functions?: string
  functionsPort?: number
  geo: 'cache' | 'mock' | 'update'
  internalDisableEdgeFunctions?: boolean
  live: string | boolean
  offline?: boolean
  offlineEnv?: boolean
  open: boolean
  port?: number
  skipGitignore?: boolean
  skipWaitPort?: boolean
  staticServerPort?: number
  targetPort?: number
}
