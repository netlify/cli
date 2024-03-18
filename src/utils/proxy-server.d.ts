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
export declare const generateInspectSettings: (edgeInspect: any, edgeInspectBrk: any) => {
    enabled: boolean;
    pause: boolean;
    address: string | undefined;
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
export declare const startProxyServer: ({ accountId, addonsUrls, blobsContext, config, configPath, debug, env, functionsRegistry, geoCountry, geolocationMode, getUpdatedConfig, inspectSettings, offline, projectDir, repositoryRoot, settings, site, siteInfo, state, }: {
    accountId: any;
    addonsUrls: any;
    blobsContext: any;
    config: any;
    configPath: any;
    debug: any;
    env: any;
    functionsRegistry: any;
    geoCountry: any;
    geolocationMode: any;
    getUpdatedConfig: any;
    inspectSettings: any;
    offline: any;
    projectDir: any;
    repositoryRoot: any;
    settings: any;
    site: any;
    siteInfo: any;
    state: any;
}) => Promise<string>;
//# sourceMappingURL=proxy-server.d.ts.map