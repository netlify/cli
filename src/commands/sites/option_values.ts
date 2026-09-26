// This type lives in a separate file to prevent import cycles.

import type { BaseOptionValues } from '../base-command.js'

export type SitesOptionValues = BaseOptionValues

export type SitesCreateOptionValues = BaseOptionValues & {
  name?: string
  accountSlug?: string
  withCi?: boolean
  manual?: boolean
  disableLinking?: boolean
  prompt?: string
  json?: boolean
}

export type SitesListOptionValues = BaseOptionValues & {
  json?: boolean
}

export type SitesSearchOptionValues = BaseOptionValues & {
  json?: boolean
}

// `--force` is added to `sites:delete` via `CI_FORCED_COMMANDS` in `main.ts`
export type SitesDeleteOptionValues = BaseOptionValues & {
  force?: boolean
}
