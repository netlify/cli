import { type RequestHandler } from 'express';
import type BaseCommand from '../../commands/base-command.js';
import type { NetlifySite } from '../../commands/types.js';
import { type NormalizedCachedConfigConfig } from '../../utils/command-helpers.js';
import type { BlobsContextWithEdgeAccess } from '../blobs/blobs.js';
import type { CLIState, ServerSettings, SiteInfo } from '../../utils/types.js';
import { FunctionsRegistry } from './registry.js';
export declare const createHandler: (options: GetFunctionsServerOptions) => RequestHandler;
interface GetFunctionsServerOptions {
    functionsRegistry: FunctionsRegistry;
    siteUrl: string;
    siteInfo?: SiteInfo;
    accountId?: string | undefined;
    geoCountry: string;
    offline: boolean;
    state: CLIState;
    config: NormalizedCachedConfigConfig;
    geolocationMode: 'cache' | 'update' | 'mock';
}
export declare const startFunctionsServer: (options: {
    blobsContext: BlobsContextWithEdgeAccess;
    command: BaseCommand;
    config: NormalizedCachedConfigConfig;
    capabilities: {
        backgroundFunctions?: boolean;
    };
    debug: boolean;
    loadDistFunctions?: boolean;
    settings: Pick<ServerSettings, "functions" | "functionsPort">;
    site: NetlifySite;
    siteInfo: SiteInfo;
    timeouts: {
        backgroundFunctions: number;
        syncFunctions: number;
    };
} & Omit<GetFunctionsServerOptions, "functionsRegistry">) => Promise<FunctionsRegistry | undefined>;
export {};
//# sourceMappingURL=server.d.ts.map