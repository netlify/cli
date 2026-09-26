// This type lives in a separate file to prevent import cycles.

import type { BaseOptionValues } from '../base-command.js'
import type { UserProvidedScope } from '../../utils/env/index.js'

interface SiteOptionValues {
  site?: string
  siteId?: string
}

export type EnvOptionValues = BaseOptionValues

export type EnvGetOptionValues = BaseOptionValues &
  SiteOptionValues & {
    context: string
    json?: boolean
    scope: UserProvidedScope | 'any'
  }

export type EnvImportOptionValues = BaseOptionValues &
  SiteOptionValues & {
    json?: boolean
    replaceExisting: boolean
  }

export type EnvListOptionValues = BaseOptionValues &
  SiteOptionValues & {
    context: string
    json?: boolean
    plain?: boolean
    scope: UserProvidedScope | 'any'
  }

export type EnvSetOptionValues = BaseOptionValues &
  SiteOptionValues & {
    context?: string[]
    // Declared at runtime via `CI_FORCED_COMMANDS` in src/commands/main.ts
    force?: boolean
    json?: boolean
    scope?: UserProvidedScope[]
    secret?: boolean
  }

export type EnvUnsetOptionValues = BaseOptionValues &
  SiteOptionValues & {
    context?: string[]
    // Declared at runtime via `CI_FORCED_COMMANDS` in src/commands/main.ts
    force?: boolean
    json?: boolean
  }

export type EnvCloneOptionValues = BaseOptionValues & {
  // Declared at runtime via `CI_FORCED_COMMANDS` in src/commands/main.ts
  force?: boolean
  from?: string
  to: string
}
