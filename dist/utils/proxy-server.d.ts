import type BaseCommand from '../commands/base-command.js';
import type { $TSFixMe, NetlifyOptions } from '../commands/types.js';
import type { BlobsContextWithEdgeAccess } from '../lib/blobs/blobs.js';
import type { FunctionsRegistry } from '../lib/functions/registry.js';
import { type NormalizedCachedConfigConfig } from './command-helpers.js';
import type CLIState from './cli-state.js';
import type { ServerSettings } from './types.js';
interface InspectSettings {
    enabled: boolean;
    pause: boolean;
    address?: string;
}
export declare const generateInspectSettings: (edgeInspect: boolean | string, edgeInspectBrk: boolean | string) => InspectSettings;
export declare const startProxyServer: ({ accountId, addonsUrls, api, blobsContext, command, config, configPath, debug, disableEdgeFunctions, env, functionsRegistry, geoCountry, geolocationMode, getUpdatedConfig, inspectSettings, offline, projectDir, repositoryRoot, settings, site, siteInfo, state, }: {
    accountId: string | undefined;
    addonsUrls: $TSFixMe;
    api?: NetlifyOptions["api"];
    blobsContext?: BlobsContextWithEdgeAccess;
    command: BaseCommand;
    config: NormalizedCachedConfigConfig;
    configPath?: string;
    debug: boolean;
    disableEdgeFunctions: boolean;
    env: NetlifyOptions["cachedConfig"]["env"];
    inspectSettings: InspectSettings;
    getUpdatedConfig: () => Promise<NormalizedCachedConfigConfig>;
    geolocationMode: string;
    geoCountry: string;
    settings: ServerSettings;
    offline: boolean;
    site: $TSFixMe;
    siteInfo: $TSFixMe;
    projectDir: string;
    repositoryRoot?: string;
    state: CLIState;
    functionsRegistry?: FunctionsRegistry;
}) => Promise<string>;
export {};
//# sourceMappingURL=proxy-server.d.ts.map