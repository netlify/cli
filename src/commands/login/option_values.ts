// This type lives in a separate file to prevent import cycles.

import type { BaseOptionValues } from '../base-command.js'

export type LoginOptionValues = BaseOptionValues & {
  check?: string
  json?: boolean
  new?: boolean
  request?: string
}
