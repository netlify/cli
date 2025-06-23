import type { NetlifyAPI } from '@netlify/api';
import type BaseCommand from '../../commands/base-command.js';
import { type NormalizedCachedConfigConfig } from '../command-helpers.js';
import type { Plugin } from '../types.js';
/**
 * Retrieve a list of plugins to auto install
 * @param pluginsToAlwaysInstall these plugins represent runtimes that are
 * expected to be "automatically" installed. Even though
 * they can be installed on package/toml, we always
 * want them installed in the site settings. When installed
 * there our build will automatically install the latest without
 * user management of the versioning.
 */
export declare const getPluginsToAutoInstall: (_command: BaseCommand, pluginsInstalled?: string[], pluginsRecommended?: string[]) => string[];
export declare const getBuildSettings: ({ command, config, }: {
    command: BaseCommand;
    config: NormalizedCachedConfigConfig;
}) => Promise<{
    baseDir: string | undefined;
    buildCmd: string;
    buildDir: string;
    functionsDir: string;
    pluginsToInstall: {
        package: string;
    }[];
}>;
export declare const saveNetlifyToml: ({ baseDir, buildCmd, buildDir, config, configPath, functionsDir, repositoryRoot, }: {
    baseDir: string | undefined;
    buildCmd: string;
    buildDir: string;
    config: NormalizedCachedConfigConfig;
    configPath: string | undefined;
    functionsDir: string | undefined;
    repositoryRoot: string;
}) => Promise<void>;
export declare const formatErrorMessage: ({ error, message }: {
    error: any;
    message: any;
}) => string;
export type DeployKey = Awaited<ReturnType<NetlifyAPI['createDeployKey']>>;
export declare const createDeployKey: ({ api }: {
    api: NetlifyAPI;
}) => Promise<DeployKey>;
type UpdateSiteRequestBody = Exclude<Parameters<NetlifyAPI['updateSite']>[0]['body'], () => unknown>;
export declare const updateSite: ({ api, options, siteId, }: {
    api: NetlifyAPI;
    options: UpdateSiteRequestBody;
    siteId: string;
}) => Promise<{
    id?: string;
    state?: string;
    plan?: string;
    name?: string;
    custom_domain?: string;
    domain_aliases?: string[];
    branch_deploy_custom_domain?: string;
    deploy_preview_custom_domain?: string;
    password?: string;
    notification_email?: string;
    url?: string;
    ssl_url?: string;
    admin_url?: string;
    screenshot_url?: string;
    created_at?: string;
    updated_at?: string;
    user_id?: string;
    session_id?: string;
    ssl?: boolean;
    force_ssl?: boolean;
    managed_dns?: boolean;
    deploy_url?: string;
    published_deploy?: import("@netlify/open-api").components["schemas"]["deploy"];
    account_id?: string;
    account_name?: string;
    account_slug?: string;
    git_provider?: string;
    deploy_hook?: string;
    capabilities?: {
        [key: string]: {
            [key: string]: unknown;
        };
    };
    processing_settings?: {
        html?: {
            pretty_urls?: boolean;
        };
    };
    build_settings?: import("@netlify/open-api").components["schemas"]["repoInfo"];
    id_domain?: string;
    default_hooks_data?: {
        access_token?: string;
    };
    build_image?: string;
    prerender?: string;
    functions_region?: string;
}>;
export declare const setupSite: ({ api, configPlugins, pluginsToInstall, repo, siteId, }: {
    api: NetlifyAPI;
    configPlugins: Plugin[];
    pluginsToInstall: {
        package: string;
    }[];
    repo: NonNullable<UpdateSiteRequestBody>["repo"];
    siteId: string;
}) => Promise<{
    id?: string;
    state?: string;
    plan?: string;
    name?: string;
    custom_domain?: string;
    domain_aliases?: string[];
    branch_deploy_custom_domain?: string;
    deploy_preview_custom_domain?: string;
    password?: string;
    notification_email?: string;
    url?: string;
    ssl_url?: string;
    admin_url?: string;
    screenshot_url?: string;
    created_at?: string;
    updated_at?: string;
    user_id?: string;
    session_id?: string;
    ssl?: boolean;
    force_ssl?: boolean;
    managed_dns?: boolean;
    deploy_url?: string;
    published_deploy?: import("@netlify/open-api").components["schemas"]["deploy"];
    account_id?: string;
    account_name?: string;
    account_slug?: string;
    git_provider?: string;
    deploy_hook?: string;
    capabilities?: {
        [key: string]: {
            [key: string]: unknown;
        };
    };
    processing_settings?: {
        html?: {
            pretty_urls?: boolean;
        };
    };
    build_settings?: import("@netlify/open-api").components["schemas"]["repoInfo"];
    id_domain?: string;
    default_hooks_data?: {
        access_token?: string;
    };
    build_image?: string;
    prerender?: string;
    functions_region?: string;
}>;
export {};
//# sourceMappingURL=utils.d.ts.map