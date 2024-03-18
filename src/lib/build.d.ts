/**
 * The buildConfig + a missing cachedConfig
 * @typedef BuildConfig
 * @type {Parameters<import('@netlify/build/src/core/main.js')>[0] & {cachedConfig: any}}
 */
/**
 *
 * @param {object} config
 * @param {*} config.cachedConfig
 * @param {string} [config.packagePath]
 * @param {string} config.currentDir
 * @param {string} config.token
 * @param {import('commander').OptionValues} config.options
 * @param {*} config.deployHandler
 * @returns {BuildConfig}
 */
export declare const getBuildOptions: ({ cachedConfig, currentDir, deployHandler, options: { context, cwd, debug, dry, json, offline, silent }, packagePath, token, }: {
    cachedConfig: any;
    currentDir: any;
    deployHandler: any;
    options: {
        context: any;
        cwd: any;
        debug: any;
        dry: any;
        json: any;
        offline: any;
        silent: any;
    };
    packagePath: any;
    token: any;
}) => {
    cachedConfig: any;
    siteId: any;
    packagePath: any;
    token: any;
    dry: any;
    debug: any;
    context: any;
    mode: string;
    telemetry: boolean;
    buffer: any;
    offline: any;
    cwd: any;
    featureFlags: {
        functionsBundlingManifest: boolean;
        edge_functions_config_export: boolean;
        edge_functions_npm_modules: boolean;
        edge_functions_read_deno_config: boolean;
    };
    eventHandlers: {
        onEnd: {
            handler: ({ netlifyConfig }: {
                netlifyConfig: any;
            }) => {};
            description: string;
        };
    };
    edgeFunctionsBootstrapURL: string;
};
/**
 * run the build command
 * @param {BuildConfig} options
 * @returns
 */
export declare const runBuild: (options: any) => Promise<{
    exitCode: number;
    newConfig: any;
    configMutations: any;
}>;
//# sourceMappingURL=build.d.ts.map