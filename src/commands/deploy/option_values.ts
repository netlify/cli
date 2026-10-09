// This type lives in a separate file to prevent import cycles.

import type { BaseOptionValues } from '../base-command.js'
import type { DeployEnvironmentVariable } from '../../utils/env/deploy-env-vars.js'

export type DeployOptionValues = BaseOptionValues & {
  alias?: string
  allowAnonymous?: boolean
  build: boolean
  branch?: string
  context?: string
  createdVia?: string
  createSite?: string | boolean
  dir?: string
  draft: boolean
  env?: DeployEnvironmentVariable[]
  functions?: string
  json: boolean
  message?: string
  open: boolean
  prod: boolean
  prodIfUnlocked: boolean
  secretEnv?: DeployEnvironmentVariable[]
  site?: string
  siteName?: string
  skipFunctionsCache: boolean
  team?: string
  timeout?: number
  trigger?: boolean
  uploadSourceZip?: boolean
}
