import { exit, log, NETLIFYDEVERR } from './command-helpers.js';
import { startProxy } from './proxy.js';
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
// @ts-expect-error TS(7006) FIXME: Parameter 'edgeInspect' implicitly has an 'any' ty... Remove this comment to see the full error message
export const generateInspectSettings = (edgeInspect, edgeInspectBrk) => {
    const enabled = Boolean(edgeInspect) || Boolean(edgeInspectBrk);
    const pause = Boolean(edgeInspectBrk);
    const getAddress = () => {
        if (edgeInspect) {
            return typeof edgeInspect === 'string' ? edgeInspect : undefined;
        }
        if (edgeInspectBrk) {
            return typeof edgeInspectBrk === 'string' ? edgeInspectBrk : undefined;
        }
    };
    return {
        enabled,
        pause,
        address: getAddress(),
    };
};
/**
 *
 * @param {object} params
 * @param {string=} params.accountId
 * @param {*} params.addonsUrls
 * @param {import("../lib/blobs/blobs.js").BlobsContext} blobsContext
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
 * @param {string} params.repositoryRoot
 * @param {import('./state-config.js').default} params.state
 * @param {import('../lib/functions/registry.js').FunctionsRegistry=} params.functionsRegistry
 * @returns
 */
export const startProxyServer = async ({ 
// @ts-expect-error TS(7031) FIXME: Binding element 'accountId' implicitly has an 'any... Remove this comment to see the full error message
accountId, 
// @ts-expect-error TS(7031) FIXME: Binding element 'addonsUrls' implicitly has an 'an... Remove this comment to see the full error message
addonsUrls, 
// @ts-expect-error TS(7031) FIXME: Binding element 'blobsContext' implicitly has an '... Remove this comment to see the full error message
blobsContext, 
// @ts-expect-error TS(7031) FIXME: Binding element 'config' implicitly has an 'any' t... Remove this comment to see the full error message
config, 
// @ts-expect-error TS(7031) FIXME: Binding element 'configPath' implicitly has an 'an... Remove this comment to see the full error message
configPath, 
// @ts-expect-error TS(7031) FIXME: Binding element 'debug' implicitly has an 'any' ty... Remove this comment to see the full error message
debug, 
// @ts-expect-error TS(7031) FIXME: Binding element 'env' implicitly has an 'any' type... Remove this comment to see the full error message
env, 
// @ts-expect-error TS(7031) FIXME: Binding element 'functionsRegistry' implicitly has... Remove this comment to see the full error message
functionsRegistry, 
// @ts-expect-error TS(7031) FIXME: Binding element 'geoCountry' implicitly has an 'an... Remove this comment to see the full error message
geoCountry, 
// @ts-expect-error TS(7031) FIXME: Binding element 'geolocationMode' implicitly has a... Remove this comment to see the full error message
geolocationMode, 
// @ts-expect-error TS(7031) FIXME: Binding element 'getUpdatedConfig' implicitly has ... Remove this comment to see the full error message
getUpdatedConfig, 
// @ts-expect-error TS(7031) FIXME: Binding element 'inspectSettings' implicitly has a... Remove this comment to see the full error message
inspectSettings, 
// @ts-expect-error TS(7031) FIXME: Binding element 'offline' implicitly has an 'any' ... Remove this comment to see the full error message
offline, 
// @ts-expect-error TS(7031) FIXME: Binding element 'projectDir' implicitly has an 'an... Remove this comment to see the full error message
projectDir, 
// @ts-expect-error TS(7031) FIXME: Binding element 'repositoryRoot' implicitly has an... Remove this comment to see the full error message
repositoryRoot, 
// @ts-expect-error TS(7031) FIXME: Binding element 'settings' implicitly has an 'any'... Remove this comment to see the full error message
settings, 
// @ts-expect-error TS(7031) FIXME: Binding element 'site' implicitly has an 'any' typ... Remove this comment to see the full error message
site, 
// @ts-expect-error TS(7031) FIXME: Binding element 'siteInfo' implicitly has an 'any'... Remove this comment to see the full error message
siteInfo, 
// @ts-expect-error TS(7031) FIXME: Binding element 'state' implicitly has an 'any' ty... Remove this comment to see the full error message
state, }) => {
    const url = await startProxy({
        addonsUrls,
        blobsContext,
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
        repositoryRoot,
    });
    if (!url) {
        log(NETLIFYDEVERR, `Unable to start proxy server on port '${settings.port}'`);
        exit(1);
    }
    return url;
};
