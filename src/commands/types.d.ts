import { NetlifyTOML } from '@netlify/build-info'
import type { NetlifyAPI } from 'netlify'

import StateConfig from '../utils/state-config.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type $TSFixMe = any;

export type NetlifySite = {
  root?: string
  configPath?: string
  siteId?: string
  get id(): string | undefined
  set id(id: string): void
}

type PatchedConfig = NetlifyTOML & {
  functionsDirectory?: string
  build: NetlifyTOML['build'] & {
    functionsSource?: string
  }
  dev: NetlifyTOML['dev'] & {
    functions?: string
  }
}

/**
 * The netlify object inside each command with the state
 */
export type NetlifyOptions = {
  // poorly duck type the missing api functions
  api: NetlifyAPI & Record<string, (...args: $TSFixMe) => Promise<$TSFixMe>>
  apiOpts: $TSFixMe
  repositoryRoot: string
  /** Absolute path of the netlify configuration file */
  configFilePath: string
  /** Relative path of the netlify configuration file */
  relConfigFilePath: string
  site: NetlifySite
  siteInfo: $TSFixMe
  config: PatchedConfig
  cachedConfig: Record<string, $TSFixMe>
  globalConfig: $TSFixMe
  state: StateConfig
}
