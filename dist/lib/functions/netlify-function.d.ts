import type { ExtendedRoute } from '@netlify/zip-it-and-ship-it';
import { type NormalizedCachedConfigConfig } from '../../utils/command-helpers.js';
import { type BlobsContextWithEdgeAccess } from '../blobs/blobs.js';
import type { ServerSettings } from '../../utils/types.js';
import type { BaseBuildResult, InvokeFunctionResult, Runtime } from './runtimes/index.js';
import type { BuildCommandCache } from './memoized-build.js';
export interface InvocationError {
    errorMessage: string;
    errorType: string;
    stackTrace: string[];
}
export type InvokeFunctionResultWithError = {
    error: Error | InvocationError;
    result: null;
};
export type InvokeFunctionResultWithSuccess = {
    error: null;
    result: InvokeFunctionResult;
};
export type InvokeResult = InvokeFunctionResultWithError | InvokeFunctionResultWithSuccess;
type MappedOmit<T, K extends keyof T> = {
    [P in keyof T as P extends K ? never : P]: T[P];
};
export default class NetlifyFunction<BuildResult extends BaseBuildResult> {
    private readonly blobsContext;
    private readonly config;
    private readonly directory?;
    private readonly projectRoot;
    private readonly timeoutBackground?;
    private readonly timeoutSynchronous?;
    private readonly settings;
    readonly displayName: string;
    mainFile: string;
    readonly name: string;
    readonly runtime: Runtime<BuildResult>;
    schedule?: string;
    readonly isBackground: boolean;
    private buildQueue?;
    buildData?: MappedOmit<BuildResult, 'includedFiles' | 'schedule' | 'srcFiles'> | undefined;
    buildError: Error | null;
    private srcFiles;
    constructor({ blobsContext, config, directory, displayName, mainFile, name, projectRoot, runtime, settings, timeoutBackground, timeoutSynchronous, }: {
        blobsContext: BlobsContextWithEdgeAccess;
        config: NormalizedCachedConfigConfig;
        directory?: string;
        displayName?: string;
        mainFile: string;
        name: string;
        projectRoot: string;
        runtime: Runtime<BuildResult>;
        settings: Pick<ServerSettings, 'functions' | 'functionsPort'>;
        timeoutBackground?: number;
        timeoutSynchronous?: number;
    });
    get filename(): string | null;
    getRecommendedExtension(): ".mjs" | ".mts" | undefined;
    hasValidName(): boolean;
    isScheduled(): Promise<boolean>;
    isSupported(): boolean;
    isTypeScript(): boolean;
    getNextRun(): Promise<Date | null>;
    build({ cache }: {
        cache?: BuildCommandCache<Record<string, unknown>>;
    }): Promise<{
        includedFiles: string[];
        srcFilesDiff: {
            added: Set<string>;
            deleted: Set<string>;
        };
        error?: undefined;
    } | {
        error: unknown;
        includedFiles?: undefined;
        srcFilesDiff?: undefined;
    }>;
    getBuildData(): Promise<typeof this.buildData>;
    getSrcFilesDiff(newSrcFiles: Set<string>): {
        added: Set<string>;
        deleted: Set<string>;
    };
    invoke(event?: Record<string, unknown>, context?: Record<string, unknown>): Promise<InvokeResult>;
    /**
     * Matches all routes agains the incoming request. If a match is found, then the matched route is returned.
     * @returns matched route
     */
    matchURLPath(rawPath: string, method: string, hasStaticFile: () => Promise<boolean>): Promise<ExtendedRoute | undefined>;
    get runtimeAPIVersion(): 1 | NonNullable<BuildResult["runtimeAPIVersion"]>;
    get url(): string;
}
export {};
//# sourceMappingURL=netlify-function.d.ts.map