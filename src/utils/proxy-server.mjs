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
 * @param {*} params.addonsUrls
 * @param {import('../commands/base-command.mjs').NetlifyOptions["config"]} params.config
 * @param {string} [params.configPath] An override for the Netlify config path
 * @param {boolean} params.debug
 * @param {import('../commands/base-command.mjs').NetlifyOptions["cachedConfig"]['env']} params.env
 * @param {InspectSettings} params.inspectSettings
 * @param {() => Promise<object>} params.getUpdatedConfig
 * @param {string} params.geolocationMode
 * @param {string} params.geoCountry
 * @param {*} params.settings
 * @param {boolean} params.offline
 * @param {*} params.site
 * @param {*} params.siteInfo
 * @param {import('./state-config.mjs').default} params.state
 * @returns
 */
export const startProxyServer = async ({
  addonsUrls,
  config,
  configPath,
  debug,
  env,
  geoCountry,
  geolocationMode,
  getUpdatedConfig,
  inspectSettings,
  offline,
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
    geolocationMode,
    geoCountry,
    getUpdatedConfig,
    inspectSettings,
    offline,
    projectDir: site.root,
    settings,
    state,
    siteInfo,
  })
  if (!url) {
    log(NETLIFYDEVERR, `Unable to start proxy server on port '${settings.port}'`)
    exit(1)
  }

  return url
}
