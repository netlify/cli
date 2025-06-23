import type { BaseCommand } from '../commands/index.js';
import type { $TSFixMe } from '../commands/types.js';
import { type NormalizedCachedConfigConfig } from './command-helpers.js';
import type { ServerSettings } from './types.js';
export declare const getProxyUrl: (settings: Pick<ServerSettings, "https" | "port">) => string;
export declare const startProxy: ({ accountId, addonsUrls, api, blobsContext, command, config, configPath, debug, disableEdgeFunctions, env, functionsRegistry, geoCountry, geolocationMode, getUpdatedConfig, inspectSettings, offline, projectDir, repositoryRoot, settings, siteInfo, state, }: {
    command: BaseCommand;
    config: NormalizedCachedConfigConfig;
    settings: ServerSettings;
    disableEdgeFunctions: boolean;
    getUpdatedConfig: () => Promise<NormalizedCachedConfigConfig>;
} & Record<string, $TSFixMe>) => Promise<string>;
//# sourceMappingURL=proxy.d.ts.map