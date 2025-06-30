import { type ListedFunction, listFunctions, type Manifest } from '@netlify/zip-it-and-ship-it';
import { type NormalizedCachedConfigConfig } from '../../utils/command-helpers.js';
import { getFrameworksAPIPaths } from '../../utils/frameworks-api.js';
import type { BlobsContextWithEdgeAccess } from '../blobs/blobs.js';
import type { ServerSettings } from '../../utils/types.js';
import NetlifyFunction from './netlify-function.js';
import { type BaseBuildResult } from './runtimes/index.js';
export declare const DEFAULT_FUNCTION_URL_EXPRESSION: RegExp;
export declare class FunctionsRegistry {
    /**
     * The functions held by the registry
     */
    private functions;
    /**
     * File watchers for function files. Maps function names to objects built
     * by the `watchDebounced` utility.
     */
    private functionWatchers;
    private directoryWatchers;
    /**
     * Keeps track of whether we've checked whether `TYPES_PACKAGE` is
     * installed.
     */
    private hasCheckedTypesPackage;
    /**
     * Context object for Netlify Blobs
     */
    private blobsContext;
    private buildCommandCache?;
    private capabilities;
    private config;
    private debug;
    private frameworksAPIPaths;
    private isConnected;
    private logLambdaCompat;
    private manifest?;
    private projectRoot;
    private settings;
    private timeouts;
    constructor({ blobsContext, capabilities, config, debug, frameworksAPIPaths, isConnected, logLambdaCompat, manifest, projectRoot, settings, timeouts, }: {
        blobsContext: BlobsContextWithEdgeAccess;
        buildCache?: Record<string, unknown>;
        capabilities: {
            backgroundFunctions?: boolean;
        };
        config: NormalizedCachedConfigConfig;
        debug?: boolean;
        frameworksAPIPaths: ReturnType<typeof getFrameworksAPIPaths>;
        isConnected?: boolean;
        logLambdaCompat: boolean;
        manifest?: Manifest;
        projectRoot: string;
        settings: Pick<ServerSettings, 'functions' | 'functionsPort'>;
        timeouts: {
            backgroundFunctions: number;
            syncFunctions: number;
        };
    });
    checkTypesPackage(): void;
    static prepareDirectory(directory: string): Promise<void>;
    /**
     * Builds a function and sets up the appropriate file watchers so that any
     * changes will trigger another build.
     */
    buildFunctionAndWatchFiles(func: NetlifyFunction<BaseBuildResult>, firstLoad?: boolean): Promise<void>;
    /**
     * Returns a function by name.
     */
    get(name: string): NetlifyFunction<BaseBuildResult> | undefined;
    /**
     * Looks for the first function that matches a given URL path. If a match is
     * found, returns an object with the function and the route. If the URL path
     * matches the default functions URL (i.e. can only be for a function) but no
     * function with the given name exists, returns an object with the function
     * and the route set to `null`. Otherwise, `undefined` is returned,
     */
    getFunctionForURLPath(urlPath: string, method: string, hasStaticFile: () => Promise<boolean>): Promise<{
        func: null;
        route: null;
    } | {
        func: NetlifyFunction<BaseBuildResult>;
        route: null;
    } | {
        func: NetlifyFunction<BaseBuildResult>;
        route: import("@netlify/zip-it-and-ship-it").ExtendedRoute;
    } | undefined>;
    /**
     * Logs an event associated with functions.
     */
    private logEvent;
    /**
     * Adds a function to the registry
     */
    registerFunction(name: string, funcBeforeHook: NetlifyFunction<BaseBuildResult>, isReload?: boolean): Promise<void>;
    /**
     * A proxy to zip-it-and-ship-it's `listFunctions` method. It exists just so
     * that we can mock it in tests.
     */
    listFunctions(...args: Parameters<typeof listFunctions>): Promise<ListedFunction[]>;
    /**
     * Takes a list of directories and scans for functions. It keeps tracks of
     * any functions in those directories that we've previously seen, and takes
     * care of registering and unregistering functions as they come and go.
     */
    scan(relativeDirs: (string | undefined)[]): Promise<void>;
    /**
     * Creates a watcher that looks at files being added or removed from a
     * functions directory. It doesn't care about files being changed, because
     * those will be handled by each functions' watcher.
     */
    setupDirectoryWatcher(directory: string): Promise<void>;
    /**
     * Removes a function from the registry and closes its file watchers.
     */
    unregisterFunction(func: NetlifyFunction<BaseBuildResult>): Promise<void>;
    /**
     * Takes a zipped function and extracts its contents to an internal directory.
     */
    unzipFunction(func: NetlifyFunction<BaseBuildResult>): Promise<string>;
}
//# sourceMappingURL=registry.d.ts.map