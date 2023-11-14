import type { PollingStrategy, NetlifyTOML } from '@netlify/build-info'

import type { FrameworkNames } from '../../utils/types'

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
