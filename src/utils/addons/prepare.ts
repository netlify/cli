import type { NetlifyAPI } from '@netlify/api'

import { logAndThrowError, type APIError } from '../command-helpers.js'

type Addon = Awaited<ReturnType<NetlifyAPI['listServiceInstancesForSite']>>[number]

export const getCurrentAddon = ({ addonName, addons }: { addonName: string; addons: Addon[] }) =>
  addons.find((addon) => addon.service_slug === addonName)

export const getSiteData = async ({ api, siteId }: { api: NetlifyAPI; siteId: string }) => {
  let siteData
  try {
    siteData = await api.getSite({ siteId })
  } catch (error_) {
    return logAndThrowError(`Failed getting list of project data: ${(error_ as APIError).message}`)
  }
  return siteData
}

export const getAddons = async ({ api, siteId }: { api: NetlifyAPI; siteId: string }) => {
  let addons
  try {
    addons = await api.listServiceInstancesForSite({ siteId })
  } catch (error_) {
    return logAndThrowError(`Failed getting list of addons: ${(error_ as APIError).message}`)
  }
  return addons
}
