import type { NetlifyTOML } from '@netlify/build-info'

import type { FrameworkNames } from '../../utils/types'

/** The configuration specified in the netlify.toml under [build] */
export type BuildConfig = NonNullable<NetlifyTOML['build']>

export type DevConfig = NonNullable<NetlifyTOML['dev']> & {
  framework: FrameworkNames
  /** Directory of the functions */
  functions?: string | undefined
  live?: boolean | undefined
  /** The base directory from the [build] section of the configuration file */
  base?: string | undefined
  staticServerPort?: number | undefined
  envFiles?: string[] | undefined

  jwtSecret?: string | undefined
  jwtRolePath?: string | undefined
  pollingStrategies?: string[] | undefined
}
