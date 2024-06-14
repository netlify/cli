import BaseCommand from '../commands/base-command.js'
import { $TSFixMe, NetlifyOptions } from '../commands/types.js'
import { BlobsContextWithEdgeAccess } from '../lib/blobs/blobs.js'
import { FunctionsRegistry } from '../lib/functions/registry.js'

import { exit, log, NETLIFYDEVERR } from './command-helpers.js'
import { startProxy } from './proxy.js'
import type StateConfig from './state-config.js'
import { ServerSettings } from './types.js'

interface InspectSettings {
  // Inspect enabled
  enabled: boolean
  // Pause on breakpoints
  pause: boolean
  // Host/port override (optional)
  address?: string
}

export const generateInspectSettings = (
  edgeInspect: boolean | string,
  edgeInspectBrk: boolean | string,
): InspectSettings => {
  const enabled = Boolean(edgeInspect) || Boolean(edgeInspectBrk)
  const pause = Boolean(edgeInspectBrk)
  const getAddress = () => {
    if (edgeInspect) {
      return typeof edgeInspect === 'string' ? edgeInspect : undefined
    }
    if (edgeInspectBrk) {
      return typeof edgeInspectBrk === 'string' ? edgeInspectBrk : undefined
    }
  }

  return {
    enabled,
    pause,
    address: getAddress(),
  }
}

export const startProxyServer = async ({
  accountId,
  addonsUrls,
  api,
  blobsContext,
  command,
  config,
  configPath,
  debug,
  disableEdgeFunctions,
  env,
  functionsRegistry,
  geoCountry,
  geolocationMode,
  getUpdatedConfig,
  inspectSettings,
  offline,
  projectDir,
  repositoryRoot,
  settings,
  site,
  siteInfo,
  state,
}: {
  accountId: string
  addonsUrls: $TSFixMe
  api?: NetlifyOptions['api']
  blobsContext?: BlobsContextWithEdgeAccess
  command: BaseCommand
  config: NetlifyOptions['config']
  // An override for the Netlify config path
  configPath?: string
  debug: boolean
  disableEdgeFunctions: boolean
  env: NetlifyOptions['cachedConfig']['env']
  inspectSettings: InspectSettings
  getUpdatedConfig: () => Promise<object>
  geolocationMode: string
  geoCountry: string
  settings: ServerSettings
  offline: boolean
  site: $TSFixMe
  siteInfo: $TSFixMe
  projectDir: string
  repositoryRoot?: string
  state: StateConfig
  functionsRegistry?: FunctionsRegistry
}) => {
  const url = await startProxy({
    addonsUrls,
    blobsContext,
    command,
    config,
    configPath: configPath || site.configPath,
    debug,
    disableEdgeFunctions,
    env,
    functionsRegistry,
    geolocationMode,
    geoCountry,
    getUpdatedConfig,
    inspectSettings,
    offline,
    projectDir,
    settings,
    state,
    siteInfo,
    accountId,
    repositoryRoot,
    api,
  })
  if (!url) {
    log(NETLIFYDEVERR, `Unable to start proxy server on port '${settings.port}'`)
    exit(1)
  }

  return url
}
