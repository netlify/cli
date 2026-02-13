import type { AIGatewayContext } from '@netlify/ai/bootstrap'

import type BaseCommand from '../commands/base-command.js'
import type { $TSFixMe, NetlifyOptions } from '../commands/types.js'
import type { BlobsContextWithEdgeAccess } from '../lib/blobs/blobs.js'
import type { FunctionsRegistry } from '../lib/functions/registry.js'

import { exit, log, NETLIFYDEVERR, type NormalizedCachedConfigConfig } from './command-helpers.js'
import { startProxy } from './proxy.js'
import type { LocalState } from './types.js'
import type { ServerSettings } from './types.js'

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
  aiGatewayContext,
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
  deployEnvironment,
}: {
  accountId: string | undefined
  addonsUrls: $TSFixMe
  aiGatewayContext?: AIGatewayContext | null
  api?: NetlifyOptions['api']
  blobsContext?: BlobsContextWithEdgeAccess
  command: BaseCommand
  config: NormalizedCachedConfigConfig
  // An override for the Netlify config path
  configPath?: string
  debug: boolean
  disableEdgeFunctions: boolean
  env: NetlifyOptions['cachedConfig']['env']
  inspectSettings: InspectSettings
  getUpdatedConfig: () => Promise<NormalizedCachedConfigConfig>
  geolocationMode: string
  geoCountry: string
  settings: ServerSettings
  offline: boolean
  site: $TSFixMe
  siteInfo: $TSFixMe
  projectDir: string
  repositoryRoot?: string
  state: LocalState
  functionsRegistry?: FunctionsRegistry
  deployEnvironment: { key: string; value: string; isSecret: boolean; scopes: string[] }[]
}) => {
  const url = await startProxy({
    addonsUrls,
    aiGatewayContext,
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
    deployEnvironment,
  })
  if (!url) {
    log(NETLIFYDEVERR, `Unable to start proxy server on port '${settings.port}'`)
    exit(1)
  }

  return url
}
