// This type lives in a separate file to prevent import cycles.

import type { BaseOptionValues } from '../base-command.js'

export type DeployOptionValues = BaseOptionValues & {
  alias?: string
  build: boolean
  branch?: string
  context?: string
  create?: string | boolean
  dir?: string
  functions?: string
  json: boolean
  message?: string
  open: boolean
  prod: boolean
  prodIfUnlocked: boolean
  site?: string
  skipFunctionsCache: boolean
  team?: string
  timeout?: number
  trigger?: boolean
}
