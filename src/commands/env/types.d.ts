import { OptionValues } from 'commander'

import type { EnvironmentVariableScope } from '../../types.d.ts'
import type { ExtendedNetlifyAPI, Context, SiteInfo } from '../api-types.d.ts'
import { $TSFixMe } from '../types.js'



export interface EnvOptions extends OptionValues {
  context: Context
  scope: EnvironmentVariableScope
  json: boolean

}

export interface EnvSetOptions extends EnvOptions {
  secret: boolean
  force: boolean
}

export interface EnvUnsetOptions extends EnvOptions {
  force: boolean
}

export interface EnvCloneOptions extends OptionValues {
  from: string,
  to: string,
  force: boolean
}

export interface EnvListOptions extends EnvOptions {
  plain: boolean
}

export interface EnvImportOptions extends OptionValues {
  replaceExisting: boolean
  json: boolean
}

export interface UnsetInEnvelopeParams {
  api: ExtendedNetlifyAPI
  context: Context[]
  key: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  siteInfo: any
}


export interface SetInEnvelopeParams extends UnsetInEnvelopeParams {
  value: string
  scope: EnvironmentVariableScope[]
  secret: boolean
}

export interface SafeGetSite {
  api: ExtendedNetlifyAPI
  siteId: string
}

export interface CloneEnvParams {
  api: ExtendedNetlifyAPI
  siteFrom: Site
  siteTo: Site
}

export interface ImportDotEnvParams {
  api: ExtendedNetlifyAPI
  options: EnvImportOptions
  importedEnv: $TSFixMe
  siteInfo: SiteInfo
}
