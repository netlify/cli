// This type lives in a separate file to prevent import cycles.

import type { BaseOptionValues } from '../base-command.js'

export type CreateOptionValues = BaseOptionValues & {
  accountSlug?: string
  agent?: string
  dir?: string
  download: boolean
  git?: string
  json?: boolean
  model?: string
  name?: string
  prompt?: string
  repoOwner?: string
  wait: boolean
}
