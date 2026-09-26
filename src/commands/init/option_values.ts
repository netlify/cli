// This type lives in a separate file to prevent import cycles.

import type { BaseOptionValues } from '../base-command.js'

export type InitOptionValues = BaseOptionValues & {
  // Added to this command by `CI_FORCED_COMMANDS` in src/commands/main.ts
  force?: boolean
  gitRemoteName?: string
  manual?: boolean
}
