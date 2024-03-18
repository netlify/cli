/**
 *
 * @param {object} config
 * @param {boolean} config.offline
 * @param {*} config.api
 * @param {*} config.site
 * @param {*} config.siteInfo
 * @returns
 */
export declare const getSiteInformation: ({ api, offline, site, siteInfo }: {
    api: any;
    offline: any;
    site: any;
    siteInfo: any;
}) => Promise<{
    addonsUrls: {
        [k: string]: any;
    };
    siteUrl: any;
    accountId: any;
    capabilities: {
        backgroundFunctions: boolean;
    };
    timeouts: {
        syncFunctions: any;
        backgroundFunctions: number;
    };
} | {
    addonsUrls: {};
    siteUrl: string;
    capabilities: {
        backgroundFunctions?: undefined;
    };
    timeouts: {
        syncFunctions: number;
        backgroundFunctions: number;
    };
    accountId?: undefined;
}>;
/**
 * @param {{devConfig: any, env: Record<string, { sources: string[], value: string}>, site: any}} param0
 * @returns {Promise<Record<string, { sources: string[], value: string}>>}
 */
export declare const getDotEnvVariables: ({ devConfig, env, site }: {
    devConfig: any;
    env: any;
    site: any;
}) => Promise<any>;
/**
 * Takes a set of environment variables in the format provided by @netlify/config and injects them into `process.env`
 * @param {Record<string, { sources: string[], value: string}>} env
 * @return {void}
 */
export declare const injectEnvVariables: (env: any) => void;
export declare const acquirePort: ({ configuredPort, defaultPort, errorMessage }: {
    configuredPort: any;
    defaultPort: any;
    errorMessage: any;
}) => Promise<number>;
export declare const processOnExit: (fn: any) => void;
//# sourceMappingURL=dev.d.ts.map