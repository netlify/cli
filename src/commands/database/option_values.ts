// This type lives in a separate file to prevent import cycles.

import type { BaseOptionValues } from '../base-command.js'

export type DbStatusOptionValues = BaseOptionValues & {
  branch?: string
  showCredentials: boolean
  json?: boolean
}

export type DbInitOptionValues = BaseOptionValues & {
  yes: boolean
}

export type DbConnectOptionValues = BaseOptionValues & {
  query?: string
  json?: boolean
}

export type DbResetOptionValues = BaseOptionValues & {
  force: boolean
  json?: boolean
}

export type DbMigrationsApplyOptionValues = BaseOptionValues & {
  to?: string
  json?: boolean
}

export type DbMigrationsNewOptionValues = BaseOptionValues & {
  description?: string
  scheme?: 'timestamp' | 'sequential'
  json?: boolean
}

export type DbMigrationsPullOptionValues = BaseOptionValues & {
  branch?: string | true
  force: boolean
  json?: boolean
}

export type DbMigrationsResetOptionValues = BaseOptionValues & {
  branch?: string
  json?: boolean
}
