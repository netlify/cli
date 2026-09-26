// This type lives in a separate file to prevent import cycles.

import type { BaseOptionValues } from '../base-command.js'

export type FunctionsOptionValues = BaseOptionValues

export type FunctionsBuildOptionValues = BaseOptionValues & {
  functions?: string
  src?: string
}

export type FunctionsCreateOptionValues = BaseOptionValues & {
  language?: string
  name?: string
  offline?: boolean
  template?: string
  url?: string
}

export type FunctionsInvokeOptionValues = BaseOptionValues & {
  functions?: string
  identity?: boolean
  name?: string
  offline?: boolean
  payload?: string
  port?: number
  querystring?: string
}

export type FunctionsListOptionValues = BaseOptionValues & {
  functions?: string
  json?: boolean
}

export type FunctionsServeOptionValues = BaseOptionValues & {
  functions?: string
  offline?: boolean
  port?: number
}
