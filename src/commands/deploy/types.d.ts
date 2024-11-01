import { ExtendedApi } from "../../types/api/index.js"
import { OptionValues } from "commander"
import { SiteInfo } from "../../types/api/sites.js"
import { $TSFixMe, NetlifySite } from "../types.js"

export interface DeployParams {
  api: ExtendedApi
  siteData: SiteInfo
}

export interface TriggerDeployParams extends DeployParams {
  options: OptionValues
  siteId: string
}

export interface RunDeployParams extends TriggerDeployParams {
  alias: string
  command: BaseCommand
  config: NetlifyConfig
  deployFolder: string
  deployTimeout: number
  deployToProduction: boolean
  functionsConfig: $TSFixMe
  functionsFolder: string | undefined
  options: OptionValues
  packagePath: string
  silent: boolean
  site: NetlifySite
  siteData: SiteInfo
  siteId?: string
  skipFunctionsCache: boolean
  title: string
}

export interface GetDeployFilesFilterParams {
  deployFolder: string
  site: NetlifySite
}

export type DeployError = {
  error_: {
    name: string
    status: number
    json?: {
      message: string
    }
    message: string
  }
  failAndExit: (error: Error | string) => void
}

export type DeployEvent = {
  phase: 'start' | 'progress' | 'error' | 'stop'
  type: 'deploy' | 'build' | 'blobs-uploading' | 'hashing' | 'edge-functions-bundling' | 'create-deploy' | 'wait-for-deploy'
  msg: string
}


