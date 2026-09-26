// This type lives in a separate file to prevent import cycles.

import type { BaseOptionValues } from '../base-command.js'

export type BlobsOptionValues = BaseOptionValues

export type BlobsDeleteOptionValues = BaseOptionValues & {
  // Added to this command by `CI_FORCED_COMMANDS` in src/commands/main.ts
  force?: boolean
  region?: string
}

export type BlobsGetOptionValues = BaseOptionValues & {
  output?: string
  region?: string
}

export type BlobsListOptionValues = BaseOptionValues & {
  directories?: boolean
  json?: boolean
  prefix?: string
  region?: string
}

export type BlobsSetOptionValues = BaseOptionValues & {
  // Added to this command by `CI_FORCED_COMMANDS` in src/commands/main.ts
  force?: boolean
  input?: string
  region?: string
}
