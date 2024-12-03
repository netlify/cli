import type { NetlifyConfig } from "@netlify/build";
import type { NetlifyTOML } from '@netlify/build-info'
import type { NetlifyAPI } from 'netlify'

import type { FrameworksAPIPaths } from "../utils/frameworks-api.ts";
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

type PatchedConfig = NetlifyTOML & Pick<NetlifyConfig, 'images'> & {
  functionsDirectory?: string
  build: NetlifyTOML['build'] & {
    functionsSource?: string
  }
  dev: NetlifyTOML['dev'] & {
    functions?: string
    processing?: DevProcessing
  }
}

type DevProcessing = {
  html?: HTMLProcessing
}

type HTMLProcessing = {
  injections?: HTMLInjection[]
}

type HTMLInjection = {
  /**
   * The location at which the `html` will be injected.
   * Defaults to `before_closing_head_tag` which will inject the HTML before the </head> tag.
   */
  location?: 'before_closing_head_tag' | 'before_closing_body_tag',
  /**
   * The injected HTML code.
   */
  html: string
}

type EnvironmentVariableScope = 'builds' | 'functions' | 'runtime' | 'post_processing'
type EnvironmentVariableSource = 'account' | 'addons' | 'configFile' | 'general' |  'internal' | 'ui'

export type EnvironmentVariables = Record<string, { sources: EnvironmentVariableSource[], value: string; scopes?: EnvironmentVariableScope[] }>

/**
 * The netlify object inside each command with the state
 */
export type NetlifyOptions = {
  accounts: $TSFixMe
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
  cachedConfig: Record<string, $TSFixMe> & { env: EnvironmentVariables }
  globalConfig: $TSFixMe
  state: StateConfig
  frameworksAPIPaths: FrameworksAPIPaths
}

export interface AddressInUseError extends Error {
  code: 'EADDRINUSE'
  errno: number
  syscall: 'listen'
  address: string
  port: number
}
