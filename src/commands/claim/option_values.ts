// This type lives in a separate file to prevent import cycles.

import type { BaseOptionValues } from '../base-command.js'

export type ClaimOptionValues = BaseOptionValues & {
  site: string
  token: string
}
