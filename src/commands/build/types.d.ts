import { tokenTuple } from "../../utils/command-helpers.ts"
import { OptionValues } from "commander"
import { Config } from "../../config/types.js"
import { SiteInfo } from "../../types/api/site.d.ts"
import { $TSFixMe } from "../../types/index.js"
import { Context } from "../types.js"

type CachedConfig = Record<string, $TSFixMe> & { env: EnvironmentVariables, siteInfo: SiteInfo }

export interface CheckOptionsParams {
  cachedConfig: CachedConfig
  token: string | null
}


export interface BuildOptions extends OptionValues {
  context: Context
  cwd: string
  debug: boolean
  dry: boolean
  json: boolean
  offline: boolean
  silent: boolean
}

export interface BuildParams {
  cachedConfig: CachedConfig
  defaultConfig?: $TSFixMe
  packagePath: string | undefined
  currentDir: string
  token: string | null
  options: BuildOptions
  deployHandler?: $TSFixMe
}

export interface BuildEventHandlers {
  onEnd: {
    handler: ({ netlifyConfig }: { netlifyConfig: NetlifyConfig }) => void
    description: string
  }
  onPostBuild?: {
    handler: $TSFixMe
    description: string
  }
}
