import type { NetlifyAPI } from '@netlify/api'

import { logAndThrowError } from '../command-helpers.js'
import { getErrorMessage } from '../errors.js'

type Addon = Awaited<ReturnType<NetlifyAPI['listServiceInstancesForSite']>>[number]

export const getCurrentAddon = ({ addonName, addons }: { addonName: string; addons: Addon[] }) =>
  addons.find((addon) => addon.service_slug === addonName)

export const getSiteData = async ({ api, siteId }: { api: NetlifyAPI; siteId: string }) => {
  let siteData
  try {
    siteData = await api.getSite({ siteId })
  } catch (error_) {
    return logAndThrowError(`Failed getting list of project data: ${getErrorMessage(error_)}`)
  }
  return siteData
}

export const getAddons = async ({ api, siteId }: { api: NetlifyAPI; siteId: string }) => {
  let addons
  try {
    addons = await api.listServiceInstancesForSite({ siteId })
  } catch (error_) {
    return logAndThrowError(`Failed getting list of addons: ${getErrorMessage(error_)}`)
  }
  return addons
}
