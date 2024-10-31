import { SiteInfo } from "../../types/api/sites.js"
import { $TSFixMe } from "../types.js"
import { ExtentedNetlifyAPI } from "../../types/api/index.js"
import { AddonParams } from "../../utils/addons/types.js"
import { ServiceInstance } from "../../types/api/service-instance.js"
export interface RegistryElement {
  name: string
  value: any
  short: string
  description?: string
  score?: $TSFixMe   
}

export type FuncType = 'edge' | 'serverless'

export type Language = 'javascript' | 'typescript' | 'go' | 'rust'

export interface Packages {
    [key: string]: string
}

export interface InstallDepsParams {
    functionPackageJson: string
    functionPath: string
    functionsDir: string
}


export interface CreateFunctionAddonParams {
    addonName: string
    addons: ServiceInstance[]
    api: ExtentedNetlifyAPI
    siteData: SiteInfo
    siteId: string
}

export interface HandleOnCompleteParams {
    command: BaseCommand
    onComplete: () => Promise<void>
}

export interface HandleAddonDidInstallParams {
    addonCreated: boolean | undefined
    addonDidInstall: (fnPath: string) => Promise<void>
    command: BaseCommand
    fnPath: string
}

export interface Function {
    mainFile: string
    name: string
    runtime: string
    urlPath: string
    isBackground: $TSFixMe
    schedule: string
}