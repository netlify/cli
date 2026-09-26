// This type lives in a separate file to prevent import cycles.

import type { BaseOptionValues } from '../base-command.js'

export type TeamsOptionValues = BaseOptionValues

export type TeamsListOptionValues = BaseOptionValues & {
  json?: boolean
}
