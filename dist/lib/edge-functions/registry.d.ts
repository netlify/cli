import BaseCommand from '../../commands/base-command.js';
import { type NormalizedCachedConfigConfig } from '../../utils/command-helpers.js';
import type { FeatureFlags } from '../../utils/feature-flags.js';
type RunIsolate = Awaited<ReturnType<typeof import('@netlify/edge-bundler').serve>>;
interface EdgeFunctionsRegistryOptions {
    command: BaseCommand;
    bundler: typeof import('@netlify/edge-bundler');
    config: NormalizedCachedConfigConfig;
    configPath: string;
    debug: boolean;
    directories: string[];
    env: Record<string, {
        sources: string[];
        value: string;
    }>;
    featureFlags: FeatureFlags;
    getUpdatedConfig: () => Promise<NormalizedCachedConfigConfig>;
    projectDir: string;
    runIsolate: RunIsolate;
    servePath: string;
    importMapFromTOML?: string;
}
export declare class EdgeFunctionsRegistry {
    importMapFromDeployConfig?: string;
    private buildError;
    private bundler;
    private configPath;
    private importMapFromTOML?;
    private declarationsFromDeployConfig;
    private declarationsFromTOML;
    private dependencyPaths;
    private directories;
    private directoryWatchers;
    private env;
    private featureFlags;
    private userFunctions;
    private internalFunctions;
    private functionPaths;
    private getUpdatedConfig;
    private initialScan;
    private manifest;
    private routes;
    private runIsolate;
    private servePath;
    private projectDir;
    private command;
    constructor({ bundler, command, config, configPath, directories, env, featureFlags, getUpdatedConfig, importMapFromTOML, projectDir, runIsolate, servePath, }: EdgeFunctionsRegistryOptions);
    private doInitialScan;
    private get functions();
    private build;
    /**
     * Builds a manifest and corresponding routes for the functions in the
     * registry, taking into account the declarations from the TOML, from
     * the deploy configuration API, and from the in-source configuration
     * found in both internal and user functions.
     */
    private buildRoutes;
    private checkForAddedOrDeletedFunctions;
    private static getDeclarationsFromTOML;
    private getDisplayName;
    private static getEnvironmentVariables;
    private handleFileChange;
    initialize(): Promise<void>;
    /**
     * Logs an event associated with functions.
     */
    private logEvent;
    /**
     * Returns the functions in the registry that should run for a given URL path
     * and HTTP method, based on the routes registered for each function.
     */
    matchURLPath(urlPath: string, method: string): {
        functionNames: string[];
        invocationMetadata: {
            function_config: Record<string, import("@netlify/edge-bundler").EdgeFunctionConfig> | undefined;
            req_routes: number[];
            routes: {
                function: string;
                path: string | undefined;
                pattern: string;
            }[];
        };
    };
    /**
     * Takes the module graph returned from the server and tracks dependencies of
     * each function.
     */
    private processGraph;
    /**
     * Thin wrapper for `#runIsolate` that skips running a build and returns an
     * empty response if there are no functions in the registry.
     */
    private runBuild;
    private get internalDirectory();
    private readDeployConfig;
    private scanForDeployConfig;
    private scanForFunctions;
    private setupWatchers;
    private setupWatcherForDirectory;
    private get usesFrameworksAPI();
}
export {};
//# sourceMappingURL=registry.d.ts.map