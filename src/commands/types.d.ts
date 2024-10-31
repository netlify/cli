import type { NetlifyConfig } from "@netlify/build";
import type { NetlifyTOML } from '@netlify/build-info'

import type { FrameworksAPIPaths } from "../utils/frameworks-api.ts";
import StateConfig from '../utils/state-config.js'

import type { ExtendedNetlifyAPI } from "../types/api/api.js";
import type { OptionValues } from 'commander'
import type { SiteInfo } from '../types/api/sites.d.ts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type $TSFixMe = any;

export type NetlifySite = {
  root?: string
  configPath?: string
  siteId?: string
  get id(): string | undefined
  set id(id: string): void
  id: string
}

export type Context = 'dev' | 'production' | 'deploy-preview' | 'branch-deploy' | 'all'
export type Scope = 'builds' | 'functions' | 'runtime' | 'post_processing'

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

export type EnvironmentVariableScope = 'builds' | 'functions' | 'runtime' | 'post_processing'
export type EnvironmentVariableSource = 'account' | 'addons' | 'configFile' | 'general' |  'internal' | 'ui'


type EnviromentVariables  = { 
  [key: string]: string 
}

export type EnvironmentVariables = Record<string, { sources: EnvironmentVariableSource[], value: string; scopes?: EnvironmentVariableScope[] }>
/**
 * The netlify object inside each command with the state
 */
export type NetlifyOptions = {
  // poorly duck type the missing api functions
  api: ExtendedNetlifyAPI & Record<string, (...args: $TSFixMe) => Promise<$TSFixMe>>
  apiOpts: $TSFixMe
  repositoryRoot: string
  /** Absolute path of the netlify configuration file */
  configFilePath: string
  /** Relative path of the netlify configuration file */
  relConfigFilePath: string
  site: NetlifySite
  siteInfo: SiteInfo
  config: PatchedConfig
  cachedConfig: Record<string, $TSFixMe> & { env: EnvironmentVariables, siteInfo: SiteInfo }
  globalConfig: $TSFixMe
  state: StateConfig
  frameworksAPIPaths: FrameworksAPIPaths
}
