// This type lives in a separate file to prevent import cycles.

import type { BaseOptionValues } from '../base-command.js'

export type BuildOptionValues = BaseOptionValues & {
  context: string
  dry: boolean
  offline?: boolean
}
