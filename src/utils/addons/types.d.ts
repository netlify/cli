import { $TSFixMe } from '../../commands/types.js'
import type { ExtendedNetlifyAPI, SiteInfo } from '../../types/api/api.js'
import type { ServiceInstance } from '../../types/api/service-instance.js'
import BaseCommand from '../base-command.js'
import { ADDON_VALIDATION } from './prepare.js'

export interface SiteParams {
  api: ExtendedNetlifyAPI
  siteId: string
}

export interface AddonParams {
  addon?: ServiceInstance
  addonName?: string
  command?: BaseCommand
  validation?: 'EXISTS' | 'NOT_EXISTS'
  siteData?: SiteInfo
}

export interface AddonManifestParams {
  addonName: string
  api: ExtendedNetlifyAPI
  error?: $TSFixMe
}

export interface GetCurrentAddonParams {
  addonName: string
  addons: ServiceInstance[]
}
