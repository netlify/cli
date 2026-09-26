import type { NetlifyTOML } from '@netlify/build-info'

import type { FrameworkNames } from '../../utils/types'

/** The configuration specified in the netlify.toml under [build] */
export type BuildConfig = NonNullable<NetlifyTOML['build']>

export type DevConfig = Omit<NonNullable<NetlifyTOML['dev']>, 'framework'> & {
  framework: FrameworkNames
  /** Directory of the functions */
  functions?: string | undefined
  live?: string | boolean | undefined
  /** The base directory from the [build] section of the configuration file */
  base?: string | undefined
  staticServerPort?: number | undefined
  envFiles?: string[] | undefined

  jwtSecret?: string | undefined
  jwtRolePath?: string | undefined
  pollingStrategies?: string[] | undefined
  watchIgnore?: string[] | undefined
}
