import type { PollingStrategy, NetlifyTOML } from '@netlify/build-info'

import type { FrameworkNames } from '../../utils/types'
import type { ExtendedNetlifyAPI } from '../../types/api/api.js'
import type { OptionValues } from 'commander'
import type { NetlifySite } from '../types.js'
import type { ServerSettings } from '../../utils/types.js'
import type { $TSFixMe } from '../types.js'

/** The configuration specified in the netlify.toml under [build] */
export type BuildConfig = NonNullable<NetlifyTOML['build']>

export type DevConfig = NonNullable<NetlifyTOML['dev']> & {
  framework: FrameworkNames
  /** Directory of the functions */
  functions?: string
  publish?: string
  /** Port to serve the functions */
  port: number
  live: boolean
  /** The base directory from the [build] section of the configuration file */
  base?: string
  staticServerPort?: number
  functionsPort?: number
  autoLaunch?: boolean
  https?: {
    keyFile: string
    certFile: string
  }
  envFiles?: string[]

  jwtSecret: string
  jwtRolePath: string
  pollingStrategies?: PollingStrategy[]
}


export interface LiveTunnelParams {
  api: ExtendedNetlifyAPI
  options: OptionValues
  settings: ServerSettings
  site: NetlifySite
  state: $TSFixMe
}
