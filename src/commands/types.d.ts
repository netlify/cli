import type { NetlifyAPI } from '@netlify/api'

import type { FrameworksAPIPaths } from '../utils/frameworks-api.ts'
import type { LocalState } from '../utils/types.ts'
import type { MinimalAccount, GlobalConfigStore, SiteInfo } from '../utils/types.ts'
import type { NormalizedCachedConfigConfig } from '../utils/command-helpers.js'
import type { CachedConfig } from '../lib/build.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type $TSFixMe = any

export type NetlifySite = {
  root?: string
  configPath?: string
  siteId?: string
  get id(): string | undefined
  set id(id: string): void
}

/**
 * The netlify object inside each command with the state
 * TODO(serhalp): Rename. These aren't options. They're more like context.
 */
export type NetlifyOptions = {
  accounts: MinimalAccount[]
  api: NetlifyAPI
  apiOpts: {
    userAgent: string
    scheme?: string
    host?: string
    pathPrefix?: string
  },
  repositoryRoot: string
  /** Absolute path of the netlify configuration file */
  configFilePath: string
  /** Relative path of the netlify configuration file */
  relConfigFilePath: string
  site: NetlifySite
  siteInfo: SiteInfo
  config: NormalizedCachedConfigConfig
  cachedConfig: CachedConfig
  globalConfig: GlobalConfigStore
  state: LocalState
  frameworksAPIPaths: FrameworksAPIPaths
}

export interface AddressInUseError extends Error {
  code: 'EADDRINUSE'
  errno: number
  syscall: 'listen'
  address: string
  port: number
}
