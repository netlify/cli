import type { IncomingMessage } from 'http';
declare const headersSymbol: unique symbol;
export declare const handleProxyRequest: (req: any, proxyReq: any) => void;
interface SiteInfo {
    id: string;
    name: string;
    url: string;
}
export declare const createSiteInfoHeader: (siteInfo: SiteInfo, localURL: string) => string;
export declare const createAccountInfoHeader: (accountInfo?: {}) => string;
/**
 *
 * @param {object} config
 * @param {*} config.accountId
 * @param {import("../blobs/blobs.js").BlobsContext} config.blobsContext
 * @param {*} config.config
 * @param {*} config.configPath
 * @param {*} config.debug
 * @param {*} config.env
 * @param {*} config.geoCountry
 * @param {*} config.geolocationMode
 * @param {*} config.getUpdatedConfig
 * @param {*} config.inspectSettings
 * @param {*} config.mainPort
 * @param {boolean=} config.offline
 * @param {*} config.passthroughPort
 * @param {*} config.projectDir
 * @param {*} config.settings
 * @param {*} config.siteInfo
 * @param {*} config.state
 * @returns
 */
export declare const initializeProxy: ({ accountId, blobsContext, config, configPath, debug, env: configEnv, geoCountry, geolocationMode, getUpdatedConfig, inspectSettings, mainPort, offline, passthroughPort, projectDir, repositoryRoot, settings, siteInfo, state, }: {
    accountId: any;
    blobsContext: any;
    config: any;
    configPath: any;
    debug: any;
    env: any;
    geoCountry: any;
    geolocationMode: any;
    getUpdatedConfig: any;
    inspectSettings: any;
    mainPort: any;
    offline: any;
    passthroughPort: any;
    projectDir: any;
    repositoryRoot: any;
    settings: any;
    siteInfo: any;
    state: any;
}) => Promise<(req: IncomingMessage & {
    [headersSymbol]: Record<string, string>;
}) => Promise<string | undefined>>;
export declare const isEdgeFunctionsRequest: (req: any) => boolean;
export {};
//# sourceMappingURL=proxy.d.ts.map