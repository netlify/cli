import type { NetlifyAPI } from '@netlify/api';
import type { EnvironmentVariables } from './types.js';
type ApiAccount = Awaited<ReturnType<NetlifyAPI['listAccountsForUser']>>[number];
type Capabilities = NonNullable<ApiAccount['capabilities']> & {
    background_functions?: {
        included?: boolean | undefined;
    } | undefined;
};
export type Capability = keyof Capabilities;
export type Account = ApiAccount & {
    capabilities?: Capabilities;
};
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
    accountId: string | undefined;
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
 */
export declare const getDotEnvVariables: ({ devConfig, env, site }: {
    devConfig: any;
    env: any;
    site: any;
}) => Promise<EnvironmentVariables>;
/**
 * Takes a set of environment variables in the format provided by @netlify/config and injects them into `process.env`
 */
export declare const injectEnvVariables: (env: EnvironmentVariables) => void;
export declare const acquirePort: ({ configuredPort, defaultPort, errorMessage, }: {
    configuredPort?: number;
    defaultPort: number;
    errorMessage: string;
}) => Promise<number>;
export declare const processOnExit: (fn: any) => void;
export declare const UNLINKED_SITE_MOCK_ID = "unlinked";
export {};
//# sourceMappingURL=dev.d.ts.map