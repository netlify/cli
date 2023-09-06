// @ts-check
import { exit, log, NETLIFYDEVERR } from './command-helpers.mjs'
import { startProxy } from './proxy.mjs'

/**
 * @typedef {Object} InspectSettings
 * @property {boolean} enabled - Inspect enabled
 * @property {boolean} pause - Pause on breakpoints
 * @property {string|undefined} address - Host/port override (optional)
 */

/**
 * @param {boolean|string} edgeInspect
 * @param {boolean|string} edgeInspectBrk
 * @returns {InspectSettings}
 */
export const generateInspectSettings = (edgeInspect, edgeInspectBrk) => {
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

/**
 *
 * @param {object} params
 * @param {string=} params.accountId
 * @param {*} params.addonsUrls
 * @param {import('../commands/types.js').NetlifyOptions["config"]} params.config
 * @param {string} [params.configPath] An override for the Netlify config path
 * @param {boolean} params.debug
 * @param {import('../commands/types.js').NetlifyOptions["cachedConfig"]['env']} params.env
 * @param {InspectSettings} params.inspectSettings
 * @param {() => Promise<object>} params.getUpdatedConfig
 * @param {string} params.geolocationMode
 * @param {string} params.geoCountry
 * @param {*} params.settings
 * @param {boolean} params.offline
 * @param {object} params.site
 * @param {*} params.siteInfo
 * @param {string} params.projectDir
 * @param {import('./state-config.mjs').default} params.state
 * @param {import('../lib/functions/registry.mjs').FunctionsRegistry=} params.functionsRegistry
 * @returns
 */
export const startProxyServer = async ({
  accountId,
  addonsUrls,
  config,
  configPath,
  debug,
  env,
  functionsRegistry,
  geoCountry,
  geolocationMode,
  getUpdatedConfig,
  inspectSettings,
  offline,
  projectDir,
  settings,
  site,
  siteInfo,
  state,
}) => {
  const url = await startProxy({
    addonsUrls,
    config,
    configPath: configPath || site.configPath,
    debug,
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
  })
  if (!url) {
    log(NETLIFYDEVERR, `Unable to start proxy server on port '${settings.port}'`)
    exit(1)
  }

  return url
}
