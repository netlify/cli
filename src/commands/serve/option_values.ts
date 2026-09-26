// This type lives in a separate file to prevent import cycles.

import type { BaseOptionValues } from '../base-command.js'

export type ServeOptionValues = BaseOptionValues & {
  context?: string
  country?: string
  dir?: string
  functions?: string
  functionsPort?: number
  geo: 'cache' | 'mock' | 'update'
  internalDisableEdgeFunctions?: boolean
  offline?: boolean
  port?: number
  staticServerPort?: number
}
