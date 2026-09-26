// This type lives in a separate file to prevent import cycles.

import type { BaseOptionValues } from '../base-command.js'

export type StatusOptionValues = BaseOptionValues & {
  json?: boolean
}

export type StatusHooksOptionValues = BaseOptionValues
