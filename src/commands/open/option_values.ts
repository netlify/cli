// This type lives in a separate file to prevent import cycles.

import type { BaseOptionValues } from '../base-command.js'

export type OpenOptionValues = BaseOptionValues & {
  site?: boolean
  admin?: boolean
}

export type OpenAdminOptionValues = BaseOptionValues

export type OpenSiteOptionValues = BaseOptionValues
