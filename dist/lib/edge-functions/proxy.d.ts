import type { IncomingMessage, ClientRequest } from 'http';
import * as bundler from '@netlify/edge-bundler';
import type BaseCommand from '../../commands/base-command.js';
import type { $TSFixMe } from '../../commands/types.js';
import { type NormalizedCachedConfigConfig } from '../../utils/command-helpers.js';
import { BlobsContextWithEdgeAccess } from '../blobs/blobs.js';
import type { CLIState, ServerSettings } from '../../utils/types.js';
export type EdgeFunctionDeclaration = bundler.Declaration;
declare const headersSymbol: unique symbol;
type ExtendedIncomingMessage = IncomingMessage & {
    [headersSymbol]: Record<string, string>;
};
export declare const handleProxyRequest: (req: ExtendedIncomingMessage, proxyReq: ClientRequest) => void;
export declare const createSiteInfoHeader: (siteInfo: {
    id?: string | undefined;
    name?: string | undefined;
    url?: string | undefined;
}, localURL?: string) => string;
export declare const initializeProxy: ({ accountId, blobsContext, command, config, configPath, debug, env: configEnv, geoCountry, geolocationMode, getUpdatedConfig, inspectSettings, mainPort, offline, passthroughPort, projectDir, repositoryRoot, settings, siteInfo, state, }: {
    accountId: string;
    blobsContext: BlobsContextWithEdgeAccess;
    command: BaseCommand;
    config: NormalizedCachedConfigConfig;
    configPath: string;
    debug: boolean;
    env: $TSFixMe;
    offline: $TSFixMe;
    geoCountry: $TSFixMe;
    geolocationMode: $TSFixMe;
    getUpdatedConfig: () => Promise<NormalizedCachedConfigConfig>;
    inspectSettings: $TSFixMe;
    mainPort: $TSFixMe;
    passthroughPort: $TSFixMe;
    projectDir: string;
    repositoryRoot?: string;
    settings: ServerSettings;
    siteInfo: $TSFixMe;
    state: CLIState;
}) => Promise<(req: ExtendedIncomingMessage) => Promise<string | undefined>>;
export declare const isEdgeFunctionsRequest: (req: IncomingMessage) => req is ExtendedIncomingMessage;
export {};
//# sourceMappingURL=proxy.d.ts.map