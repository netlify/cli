// This type lives in a separate file to prevent import cycles.

import type { BaseOptionValues } from '../base-command.js'

export type LinkOptionValues = BaseOptionValues & {
  id?: string | undefined
  name?: string | undefined
  gitRemoteUrl?: string | undefined
  gitRemoteName?: string | undefined
}
