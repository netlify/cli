import { NetlifyTOML } from '@netlify/build-info'
import type { NetlifyAPI } from 'netlify'

import StateConfig from '../utils/state-config.mjs'

export type NetlifySite = {
  root?: string
  configPath?: string
  siteId?: string
  get id(): string | undefined
  set id(id: string): void
}

/**
 * The netlify object inside each command with the state
 */
export type NetlifyOptions = {
  api: NetlifyAPI
  apiOpts: unknown
  repositoryRoot: string
  /** Absolute path of the netlify configuration file */
  configFilePath: string
  /** Relative path of the netlify configuration file */
  relConfigFilePath: string
  site: NetlifySite
  siteInfo: unknown
  config: NetlifyTOML
  cachedConfig: Record<string, unknown>
  globalConfig: unknown
  state: StateConfig
}
