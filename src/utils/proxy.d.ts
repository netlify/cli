/**
 * @param {Pick<import('./types.js').ServerSettings, "https" | "port">} settings
 * @returns
 */
export declare const getProxyUrl: (settings: any) => string;
export declare const startProxy: ({ accountId, addonsUrls, blobsContext, config, configPath, debug, env, functionsRegistry, geoCountry, geolocationMode, getUpdatedConfig, inspectSettings, offline, projectDir, repositoryRoot, settings, siteInfo, state, }: {
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
    siteInfo: any;
    state: any;
}) => Promise<string>;
//# sourceMappingURL=proxy.d.ts.map