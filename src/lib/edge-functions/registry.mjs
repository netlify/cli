var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _EdgeFunctionsRegistry_instances, _a, _EdgeFunctionsRegistry_bundler, _EdgeFunctionsRegistry_configPath, _EdgeFunctionsRegistry_debug, _EdgeFunctionsRegistry_directories, _EdgeFunctionsRegistry_internalDirectories, _EdgeFunctionsRegistry_getUpdatedConfig, _EdgeFunctionsRegistry_runIsolate, _EdgeFunctionsRegistry_buildError, _EdgeFunctionsRegistry_declarationsFromDeployConfig, _EdgeFunctionsRegistry_declarationsFromTOML, _EdgeFunctionsRegistry_env, _EdgeFunctionsRegistry_directoryWatchers, _EdgeFunctionsRegistry_dependencyPaths, _EdgeFunctionsRegistry_functionPaths, _EdgeFunctionsRegistry_manifest, _EdgeFunctionsRegistry_userFunctions, _EdgeFunctionsRegistry_internalFunctions, _EdgeFunctionsRegistry_initialScan, _EdgeFunctionsRegistry_routes, _EdgeFunctionsRegistry_servePath, _EdgeFunctionsRegistry_doInitialScan, _EdgeFunctionsRegistry_functions_get, _EdgeFunctionsRegistry_build, _EdgeFunctionsRegistry_buildRoutes, _EdgeFunctionsRegistry_checkForAddedOrDeletedFunctions, _EdgeFunctionsRegistry_getDeclarationsFromTOML, _EdgeFunctionsRegistry_getEnvironmentVariables, _EdgeFunctionsRegistry_handleFileChange, _EdgeFunctionsRegistry_logEvent, _EdgeFunctionsRegistry_processGraph, _EdgeFunctionsRegistry_runBuild, _EdgeFunctionsRegistry_scanForFunctions, _EdgeFunctionsRegistry_setupWatchers, _EdgeFunctionsRegistry_setupWatcherForDirectory, _EdgeFunctionsRegistry_getDisplayName;
import { fileURLToPath } from 'url';
import { NETLIFYDEVERR, NETLIFYDEVLOG, NETLIFYDEVWARN, chalk, log, warn, watchDebounced, } from '../../utils/command-helpers.mjs';
/** @typedef {import('@netlify/edge-bundler').Declaration} Declaration */
/** @typedef {import('@netlify/edge-bundler').EdgeFunction} EdgeFunction */
/**
 * @typedef {"buildError" | "loaded" | "reloaded" | "reloading" | "removed"} EdgeFunctionEvent
 */
/** @typedef {import('@netlify/edge-bundler').FunctionConfig} FunctionConfig */
/** @typedef {import('@netlify/edge-bundler').Manifest} Manifest */
/** @typedef {import('@netlify/edge-bundler').ModuleGraph} ModuleGraph */
/** @typedef {Awaited<ReturnType<typeof import('@netlify/edge-bundler').serve>>} RunIsolate */
/** @typedef {Omit<Manifest["routes"][0], "pattern"> & { pattern: RegExp }} Route */
const featureFlags = { edge_functions_correct_order: true };
export class EdgeFunctionsRegistry {
    /**
     * @param {Object} opts
     * @param {import('@netlify/edge-bundler')} opts.bundler
     * @param {object} opts.config
     * @param {string} opts.configPath
     * @param {boolean} opts.debug
     * @param {string[]} opts.directories
     * @param {Record<string, { sources: string[], value: string}>} opts.env
     * @param {() => Promise<object>} opts.getUpdatedConfig
     * @param {string[]} opts.internalDirectories
     * @param {Declaration[]} opts.internalFunctions
     * @param {string} opts.projectDir
     * @param {RunIsolate} opts.runIsolate
     * @param {string} opts.servePath
     */
    constructor({ 
    // @ts-expect-error TS(7031) FIXME: Binding element 'bundler' implicitly has an 'any' ... Remove this comment to see the full error message
    bundler, 
    // @ts-expect-error TS(7031) FIXME: Binding element 'config' implicitly has an 'any' t... Remove this comment to see the full error message
    config, 
    // @ts-expect-error TS(7031) FIXME: Binding element 'configPath' implicitly has an 'an... Remove this comment to see the full error message
    configPath, 
    // @ts-expect-error TS(7031) FIXME: Binding element 'debug' implicitly has an 'any' ty... Remove this comment to see the full error message
    debug, 
    // @ts-expect-error TS(7031) FIXME: Binding element 'directories' implicitly has an 'a... Remove this comment to see the full error message
    directories, 
    // @ts-expect-error TS(7031) FIXME: Binding element 'env' implicitly has an 'any' type... Remove this comment to see the full error message
    env, 
    // @ts-expect-error TS(7031) FIXME: Binding element 'getUpdatedConfig' implicitly has ... Remove this comment to see the full error message
    getUpdatedConfig, 
    // @ts-expect-error TS(7031) FIXME: Binding element 'internalDirectories' implicitly h... Remove this comment to see the full error message
    internalDirectories, 
    // @ts-expect-error TS(7031) FIXME: Binding element 'internalFunctions' implicitly has... Remove this comment to see the full error message
    internalFunctions, 
    // @ts-expect-error TS(7031) FIXME: Binding element 'projectDir' implicitly has an 'an... Remove this comment to see the full error message
    projectDir, 
    // @ts-expect-error TS(7031) FIXME: Binding element 'runIsolate' implicitly has an 'an... Remove this comment to see the full error message
    runIsolate, 
    // @ts-expect-error TS(7031) FIXME: Binding element 'servePath' implicitly has an 'any... Remove this comment to see the full error message
    servePath, }) {
        _EdgeFunctionsRegistry_instances.add(this);
        /** @type {import('@netlify/edge-bundler')} */
        _EdgeFunctionsRegistry_bundler.set(this, void 0);
        /** @type {string} */
        _EdgeFunctionsRegistry_configPath.set(this, void 0);
        /** @type {boolean} */
        _EdgeFunctionsRegistry_debug.set(this, void 0);
        /** @type {string[]} */
        _EdgeFunctionsRegistry_directories.set(this, void 0);
        /** @type {string[]} */
        _EdgeFunctionsRegistry_internalDirectories.set(this, void 0);
        /** @type {() => Promise<object>} */
        _EdgeFunctionsRegistry_getUpdatedConfig.set(this, void 0);
        /** @type {RunIsolate} */
        _EdgeFunctionsRegistry_runIsolate.set(this, void 0);
        /** @type {Error | null} */
        _EdgeFunctionsRegistry_buildError.set(this, null
        /** @type {Declaration[]} */
        );
        /** @type {Declaration[]} */
        _EdgeFunctionsRegistry_declarationsFromDeployConfig.set(this, void 0);
        /** @type {Declaration[]} */
        _EdgeFunctionsRegistry_declarationsFromTOML.set(this, void 0);
        /** @type {Record<string, string>} */
        _EdgeFunctionsRegistry_env.set(this, void 0);
        /** @type {Map<string, import('chokidar').FSWatcher>} */
        _EdgeFunctionsRegistry_directoryWatchers.set(this, new Map()
        /** @type {Map<string, string[]>} */
        );
        /** @type {Map<string, string[]>} */
        _EdgeFunctionsRegistry_dependencyPaths.set(this, new Map()
        /** @type {Map<string, string>} */
        );
        /** @type {Map<string, string>} */
        _EdgeFunctionsRegistry_functionPaths.set(this, new Map()
        /** @type {Manifest | null} */
        );
        /** @type {Manifest | null} */
        _EdgeFunctionsRegistry_manifest.set(this, null
        /** @type {EdgeFunction[]} */
        );
        /** @type {EdgeFunction[]} */
        _EdgeFunctionsRegistry_userFunctions.set(this, []
        /** @type {EdgeFunction[]} */
        );
        /** @type {EdgeFunction[]} */
        _EdgeFunctionsRegistry_internalFunctions.set(this, []
        /** @type {Promise<void>} */
        );
        /** @type {Promise<void>} */
        _EdgeFunctionsRegistry_initialScan.set(this, void 0);
        /** @type {Route[]} */
        _EdgeFunctionsRegistry_routes.set(this, []
        /** @type {string} */
        );
        /** @type {string} */
        _EdgeFunctionsRegistry_servePath.set(this, void 0);
        __classPrivateFieldSet(this, _EdgeFunctionsRegistry_bundler, bundler, "f");
        __classPrivateFieldSet(this, _EdgeFunctionsRegistry_configPath, configPath, "f");
        __classPrivateFieldSet(this, _EdgeFunctionsRegistry_debug, debug, "f");
        __classPrivateFieldSet(this, _EdgeFunctionsRegistry_directories, directories, "f");
        __classPrivateFieldSet(this, _EdgeFunctionsRegistry_internalDirectories, internalDirectories, "f");
        __classPrivateFieldSet(this, _EdgeFunctionsRegistry_getUpdatedConfig, getUpdatedConfig, "f");
        __classPrivateFieldSet(this, _EdgeFunctionsRegistry_runIsolate, runIsolate, "f");
        __classPrivateFieldSet(this, _EdgeFunctionsRegistry_servePath, servePath, "f");
        __classPrivateFieldSet(this, _EdgeFunctionsRegistry_declarationsFromDeployConfig, internalFunctions, "f");
        __classPrivateFieldSet(this, _EdgeFunctionsRegistry_declarationsFromTOML, __classPrivateFieldGet(EdgeFunctionsRegistry, _a, "m", _EdgeFunctionsRegistry_getDeclarationsFromTOML).call(EdgeFunctionsRegistry, config), "f");
        __classPrivateFieldSet(this, _EdgeFunctionsRegistry_env, __classPrivateFieldGet(EdgeFunctionsRegistry, _a, "m", _EdgeFunctionsRegistry_getEnvironmentVariables).call(EdgeFunctionsRegistry, env), "f");
        __classPrivateFieldSet(this, _EdgeFunctionsRegistry_buildError, null, "f");
        __classPrivateFieldSet(this, _EdgeFunctionsRegistry_directoryWatchers, new Map(), "f");
        __classPrivateFieldSet(this, _EdgeFunctionsRegistry_dependencyPaths, new Map(), "f");
        __classPrivateFieldSet(this, _EdgeFunctionsRegistry_functionPaths, new Map(), "f");
        __classPrivateFieldSet(this, _EdgeFunctionsRegistry_userFunctions, [], "f");
        __classPrivateFieldSet(this, _EdgeFunctionsRegistry_internalFunctions, [], "f");
        __classPrivateFieldSet(this, _EdgeFunctionsRegistry_initialScan, __classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "m", _EdgeFunctionsRegistry_doInitialScan).call(this), "f");
        __classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "m", _EdgeFunctionsRegistry_setupWatchers).call(this, projectDir);
    }
    /**
     * @return {Promise<void>}
     */
    async initialize() {
        return await __classPrivateFieldGet(this, _EdgeFunctionsRegistry_initialScan, "f");
    }
    /**
     * Returns the functions in the registry that should run for a given URL path
     * and HTTP method, based on the routes registered for each function.
     *
     * @param {string} urlPath
     * @param {string} method
     */
    // @ts-expect-error TS(7006) FIXME: Parameter 'urlPath' implicitly has an 'any' type.
    matchURLPath(urlPath, method) {
        /** @type string[] */
        // @ts-expect-error TS(7034) FIXME: Variable 'functionNames' implicitly has type 'any[... Remove this comment to see the full error message
        const functionNames = [];
        /** @type number[] */
        // @ts-expect-error TS(7034) FIXME: Variable 'routeIndexes' implicitly has type 'any[]... Remove this comment to see the full error message
        const routeIndexes = [];
        __classPrivateFieldGet(this, _EdgeFunctionsRegistry_routes, "f").forEach((route, index) => {
            // @ts-expect-error TS(2339) FIXME: Property 'methods' does not exist on type 'never'.
            if (route.methods && route.methods.length !== 0 && !route.methods.includes(method)) {
                return;
            }
            // @ts-expect-error TS(2339) FIXME: Property 'pattern' does not exist on type 'never'.
            if (!route.pattern.test(urlPath)) {
                return;
            }
            // @ts-expect-error TS(2339) FIXME: Property 'function_config' does not exist on type ... Remove this comment to see the full error message
            const isExcluded = __classPrivateFieldGet(this, _EdgeFunctionsRegistry_manifest, "f")?.function_config[route.function]?.excluded_patterns?.some((pattern) => new RegExp(pattern).test(urlPath));
            if (isExcluded) {
                return;
            }
            // @ts-expect-error TS(2339) FIXME: Property 'function' does not exist on type 'never'... Remove this comment to see the full error message
            functionNames.push(route.function);
            routeIndexes.push(index);
        });
        const invocationMetadata = {
            // @ts-expect-error TS(2339) FIXME: Property 'function_config' does not exist on type ... Remove this comment to see the full error message
            function_config: __classPrivateFieldGet(this, _EdgeFunctionsRegistry_manifest, "f")?.function_config,
            // @ts-expect-error TS(7005) FIXME: Variable 'routeIndexes' implicitly has an 'any[]' ... Remove this comment to see the full error message
            req_routes: routeIndexes,
            // @ts-expect-error TS(2339) FIXME: Property 'routes' does not exist on type 'never'.
            routes: __classPrivateFieldGet(this, _EdgeFunctionsRegistry_manifest, "f")?.routes.map((route) => ({
                function: route.function,
                path: route.path,
                pattern: route.pattern,
            })),
        };
        // @ts-expect-error TS(7005) FIXME: Variable 'functionNames' implicitly has an 'any[]'... Remove this comment to see the full error message
        return { functionNames, invocationMetadata };
    }
}
_a = EdgeFunctionsRegistry, _EdgeFunctionsRegistry_bundler = new WeakMap(), _EdgeFunctionsRegistry_configPath = new WeakMap(), _EdgeFunctionsRegistry_debug = new WeakMap(), _EdgeFunctionsRegistry_directories = new WeakMap(), _EdgeFunctionsRegistry_internalDirectories = new WeakMap(), _EdgeFunctionsRegistry_getUpdatedConfig = new WeakMap(), _EdgeFunctionsRegistry_runIsolate = new WeakMap(), _EdgeFunctionsRegistry_buildError = new WeakMap(), _EdgeFunctionsRegistry_declarationsFromDeployConfig = new WeakMap(), _EdgeFunctionsRegistry_declarationsFromTOML = new WeakMap(), _EdgeFunctionsRegistry_env = new WeakMap(), _EdgeFunctionsRegistry_directoryWatchers = new WeakMap(), _EdgeFunctionsRegistry_dependencyPaths = new WeakMap(), _EdgeFunctionsRegistry_functionPaths = new WeakMap(), _EdgeFunctionsRegistry_manifest = new WeakMap(), _EdgeFunctionsRegistry_userFunctions = new WeakMap(), _EdgeFunctionsRegistry_internalFunctions = new WeakMap(), _EdgeFunctionsRegistry_initialScan = new WeakMap(), _EdgeFunctionsRegistry_routes = new WeakMap(), _EdgeFunctionsRegistry_servePath = new WeakMap(), _EdgeFunctionsRegistry_instances = new WeakSet(), _EdgeFunctionsRegistry_doInitialScan = 
/**
 * @returns {Promise<void>}
 */
async function _EdgeFunctionsRegistry_doInitialScan() {
    await __classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "m", _EdgeFunctionsRegistry_scanForFunctions).call(this);
    try {
        const { warnings } = await __classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "m", _EdgeFunctionsRegistry_build).call(this);
        __classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "a", _EdgeFunctionsRegistry_functions_get).forEach((func) => {
            // @ts-expect-error TS(2345) FIXME: Argument of type '{ functionName: any; warnings: a... Remove this comment to see the full error message
            __classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "m", _EdgeFunctionsRegistry_logEvent).call(this, 'loaded', { functionName: func.name, warnings: warnings[func.name] });
        });
    }
    catch {
        // no-op
    }
}, _EdgeFunctionsRegistry_functions_get = function _EdgeFunctionsRegistry_functions_get() {
    return [...__classPrivateFieldGet(this, _EdgeFunctionsRegistry_internalFunctions, "f"), ...__classPrivateFieldGet(this, _EdgeFunctionsRegistry_userFunctions, "f")];
}, _EdgeFunctionsRegistry_build = 
/**
 * @return {Promise<{warnings: Record<string, string[]>}>}
 */
async function _EdgeFunctionsRegistry_build() {
    /**
     * @type Record<string, string[]>
     */
    const warnings = {};
    try {
        const { functionsConfig, graph, npmSpecifiersWithExtraneousFiles, success } = await __classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "m", _EdgeFunctionsRegistry_runBuild).call(this);
        if (!success) {
            throw new Error('Build error');
        }
        __classPrivateFieldSet(this, _EdgeFunctionsRegistry_buildError, null, "f");
        // We use one index to loop over both internal and user function, because we know that this.#functions has internalFunctions first.
        // functionsConfig therefore contains first all internal functionConfigs and then user functionConfigs
        let index = 0;
        /** @type {Record<string, FunctionConfig>} */
        const internalFunctionConfigs = __classPrivateFieldGet(this, _EdgeFunctionsRegistry_internalFunctions, "f").reduce(
        // @ts-expect-error TS(2339) FIXME: Property 'name' does not exist on type 'never'.
        // eslint-disable-next-line no-plusplus
        (acc, func) => ({ ...acc, [func.name]: functionsConfig[index++] }), {});
        /** @type {Record<string, FunctionConfig>} */
        const userFunctionConfigs = __classPrivateFieldGet(this, _EdgeFunctionsRegistry_userFunctions, "f").reduce(
        // @ts-expect-error TS(2339) FIXME: Property 'name' does not exist on type 'never'.
        // eslint-disable-next-line no-plusplus
        (acc, func) => ({ ...acc, [func.name]: functionsConfig[index++] }), {});
        const { manifest, routes, unroutedFunctions } = __classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "m", _EdgeFunctionsRegistry_buildRoutes).call(this, internalFunctionConfigs, userFunctionConfigs);
        __classPrivateFieldSet(this, _EdgeFunctionsRegistry_manifest, manifest, "f");
        // @ts-expect-error TS(2322) FIXME: Type 'any[]' is not assignable to type 'never[]'.
        __classPrivateFieldSet(this, _EdgeFunctionsRegistry_routes, routes, "f");
        // @ts-expect-error TS(7006) FIXME: Parameter 'name' implicitly has an 'any' type.
        unroutedFunctions.forEach((name) => {
            // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            warnings[name] = warnings[name] || [];
            // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            warnings[name].push(`Edge function is not accessible because it does not have a path configured. Learn more at https://ntl.fyi/edge-create.`);
        });
        for (const functionName in userFunctionConfigs) {
            // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            if ('paths' in userFunctionConfigs[functionName]) {
                // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                warnings[functionName] = warnings[functionName] || [];
                // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                warnings[functionName].push(`Unknown 'paths' configuration property. Did you mean 'path'?`);
            }
        }
        __classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "m", _EdgeFunctionsRegistry_processGraph).call(this, graph);
        if (npmSpecifiersWithExtraneousFiles.length !== 0) {
            // @ts-expect-error TS(7006) FIXME: Parameter 'name' implicitly has an 'any' type.
            const modules = npmSpecifiersWithExtraneousFiles.map((name) => chalk.yellow(name)).join(', ');
            log(`${NETLIFYDEVWARN} The following npm modules, which are directly or indirectly imported by an edge function, may not be supported: ${modules}. For more information, visit https://ntl.fyi/edge-functions-npm.`);
        }
        return { warnings };
    }
    catch (error) {
        // @ts-expect-error TS(2322) FIXME: Type 'unknown' is not assignable to type 'null'.
        __classPrivateFieldSet(this, _EdgeFunctionsRegistry_buildError, error, "f");
        throw error;
    }
}, _EdgeFunctionsRegistry_buildRoutes = function _EdgeFunctionsRegistry_buildRoutes(internalFunctionConfigs, userFunctionConfigs) {
    const declarations = __classPrivateFieldGet(this, _EdgeFunctionsRegistry_bundler, "f").mergeDeclarations(__classPrivateFieldGet(this, _EdgeFunctionsRegistry_declarationsFromTOML, "f"), userFunctionConfigs, internalFunctionConfigs, __classPrivateFieldGet(this, _EdgeFunctionsRegistry_declarationsFromDeployConfig, "f"), featureFlags);
    const { declarationsWithoutFunction, manifest, unroutedFunctions } = __classPrivateFieldGet(this, _EdgeFunctionsRegistry_bundler, "f").generateManifest({
        declarations,
        userFunctionConfig: userFunctionConfigs,
        internalFunctionConfig: internalFunctionConfigs,
        functions: __classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "a", _EdgeFunctionsRegistry_functions_get),
        featureFlags,
    });
    const routes = [...manifest.routes, ...manifest.post_cache_routes].map((route) => ({
        ...route,
        pattern: new RegExp(route.pattern),
    }));
    return { declarationsWithoutFunction, manifest, routes, unroutedFunctions };
}, _EdgeFunctionsRegistry_checkForAddedOrDeletedFunctions = 
/**
 * @returns {Promise<void>}
 */
async function _EdgeFunctionsRegistry_checkForAddedOrDeletedFunctions() {
    const { deleted: deletedFunctions, new: newFunctions } = await __classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "m", _EdgeFunctionsRegistry_scanForFunctions).call(this);
    if (newFunctions.length === 0 && deletedFunctions.length === 0) {
        return;
    }
    try {
        const { warnings } = await __classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "m", _EdgeFunctionsRegistry_build).call(this);
        deletedFunctions.forEach((func) => {
            // @ts-expect-error TS(2345) FIXME: Argument of type '{ functionName: any; warnings: a... Remove this comment to see the full error message
            __classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "m", _EdgeFunctionsRegistry_logEvent).call(this, 'removed', { functionName: func.name, warnings: warnings[func.name] });
        });
        newFunctions.forEach((func) => {
            // @ts-expect-error TS(2345) FIXME: Argument of type '{ functionName: any; warnings: a... Remove this comment to see the full error message
            __classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "m", _EdgeFunctionsRegistry_logEvent).call(this, 'loaded', { functionName: func.name, warnings: warnings[func.name] });
        });
    }
    catch {
        // no-op
    }
}, _EdgeFunctionsRegistry_getDeclarationsFromTOML = function _EdgeFunctionsRegistry_getDeclarationsFromTOML(config) {
    const { edge_functions: edgeFunctions = [] } = config;
    return edgeFunctions;
}, _EdgeFunctionsRegistry_getEnvironmentVariables = function _EdgeFunctionsRegistry_getEnvironmentVariables(envConfig) {
    const env = Object.create(null);
    Object.entries(envConfig).forEach(([key, variable]) => {
        if (
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        variable.sources.includes('ui') ||
            // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
            variable.sources.includes('account') ||
            // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
            variable.sources.includes('addons') ||
            // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
            variable.sources.includes('internal') ||
            // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
            variable.sources.some((source) => source.startsWith('.env'))) {
            // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
            env[key] = variable.value;
        }
    });
    env.DENO_REGION = 'local';
    return env;
}, _EdgeFunctionsRegistry_handleFileChange = 
/**
 * @param {string[]} paths
 * @returns {Promise<void>}
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'paths' implicitly has an 'any' type.
async function _EdgeFunctionsRegistry_handleFileChange(paths) {
    const matchingFunctions = new Set([
        // @ts-expect-error TS(7006) FIXME: Parameter 'path' implicitly has an 'any' type.
        ...paths.map((path) => __classPrivateFieldGet(this, _EdgeFunctionsRegistry_functionPaths, "f").get(path)),
        // @ts-expect-error TS(7006) FIXME: Parameter 'path' implicitly has an 'any' type.
        ...paths.flatMap((path) => __classPrivateFieldGet(this, _EdgeFunctionsRegistry_dependencyPaths, "f").get(path)),
    ].filter(Boolean));
    // If the file is not associated with any function, there's no point in
    // building. However, it might be that the path is in fact associated with
    // a function but we just haven't registered it due to a build error. So if
    // there was a build error, let's always build.
    if (matchingFunctions.size === 0 && __classPrivateFieldGet(this, _EdgeFunctionsRegistry_buildError, "f") === null) {
        return;
    }
    // @ts-expect-error TS(2345) FIXME: Argument of type '{}' is not assignable to paramet... Remove this comment to see the full error message
    __classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "m", _EdgeFunctionsRegistry_logEvent).call(this, 'reloading', {});
    try {
        const { warnings } = await __classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "m", _EdgeFunctionsRegistry_build).call(this);
        const functionNames = [...matchingFunctions];
        if (functionNames.length === 0) {
            // @ts-expect-error TS(2345) FIXME: Argument of type '{}' is not assignable to paramet... Remove this comment to see the full error message
            __classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "m", _EdgeFunctionsRegistry_logEvent).call(this, 'reloaded', {});
        }
        else {
            functionNames.forEach((functionName) => {
                // @ts-expect-error TS(2345) FIXME: Argument of type '{ functionName: any; warnings: a... Remove this comment to see the full error message
                __classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "m", _EdgeFunctionsRegistry_logEvent).call(this, 'reloaded', { functionName, warnings: warnings[functionName] });
            });
        }
    }
    catch (error) {
        // @ts-expect-error TS(2345) FIXME: Argument of type '{ buildError: any; }' is not ass... Remove this comment to see the full error message
        __classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "m", _EdgeFunctionsRegistry_logEvent).call(this, 'buildError', { buildError: error?.message });
    }
}, _EdgeFunctionsRegistry_logEvent = function _EdgeFunctionsRegistry_logEvent(event, { buildError, functionName, warnings = [] }) {
    const subject = functionName
        ? `edge function ${chalk.yellow(__classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "m", _EdgeFunctionsRegistry_getDisplayName).call(this, functionName))}`
        : 'edge functions';
    const warningsText = warnings.length === 0 ? '' : ` with warnings:\n${warnings.map((warning) => `  - ${warning}`).join('\n')}`;
    if (event === 'buildError') {
        log(`${NETLIFYDEVERR} ${chalk.red('Failed to load')} ${subject}: ${buildError}`);
        return;
    }
    if (event === 'loaded') {
        const icon = warningsText ? NETLIFYDEVWARN : NETLIFYDEVLOG;
        const color = warningsText ? chalk.yellow : chalk.green;
        log(`${icon} ${color('Loaded')} ${subject}${warningsText}`);
        return;
    }
    if (event === 'reloaded') {
        const icon = warningsText ? NETLIFYDEVWARN : NETLIFYDEVLOG;
        const color = warningsText ? chalk.yellow : chalk.green;
        log(`${icon} ${color('Reloaded')} ${subject}${warningsText}`);
        return;
    }
    if (event === 'reloading') {
        log(`${NETLIFYDEVLOG} ${chalk.magenta('Reloading')} ${subject}...`);
        return;
    }
    if (event === 'removed') {
        log(`${NETLIFYDEVLOG} ${chalk.magenta('Removed')} ${subject}`);
    }
}, _EdgeFunctionsRegistry_processGraph = function _EdgeFunctionsRegistry_processGraph(graph) {
    if (!graph) {
        warn('Could not process edge functions dependency graph. Live reload will not be available.');
        return;
    }
    // Creating a Map from `this.#functions` that map function paths to function
    // names. This allows us to match modules against functions in O(1) time as
    // opposed to O(n).
    // @ts-expect-error TS(2339) FIXME: Property 'path' does not exist on type 'never'.
    // eslint-disable-next-line unicorn/prefer-spread
    const functionPaths = new Map(Array.from(__classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "a", _EdgeFunctionsRegistry_functions_get), (func) => [func.path, func.name]));
    // Mapping file URLs to names of functions that use them as dependencies.
    const dependencyPaths = new Map();
    // @ts-expect-error TS(7031) FIXME: Binding element 'specifier' implicitly has an 'any... Remove this comment to see the full error message
    graph.modules.forEach(({ dependencies = [], specifier }) => {
        if (!specifier.startsWith('file://')) {
            return;
        }
        const path = fileURLToPath(specifier);
        const functionMatch = functionPaths.get(path);
        if (!functionMatch) {
            return;
        }
        dependencies.forEach((dependency) => {
            // We're interested in tracking local dependencies, so we only look at
            // specifiers with the `file:` protocol.
            if (
            // @ts-expect-error TS(2339) FIXME: Property 'code' does not exist on type 'never'.
            dependency.code === undefined ||
                // @ts-expect-error TS(2339) FIXME: Property 'code' does not exist on type 'never'.
                typeof dependency.code.specifier !== 'string' ||
                // @ts-expect-error TS(2339) FIXME: Property 'code' does not exist on type 'never'.
                !dependency.code.specifier.startsWith('file://')) {
                return;
            }
            // @ts-expect-error TS(2339) FIXME: Property 'code' does not exist on type 'never'.
            const { specifier: dependencyURL } = dependency.code;
            const dependencyPath = fileURLToPath(dependencyURL);
            const functions = dependencyPaths.get(dependencyPath) || [];
            dependencyPaths.set(dependencyPath, [...functions, functionMatch]);
        });
    });
    __classPrivateFieldSet(this, _EdgeFunctionsRegistry_dependencyPaths, dependencyPaths, "f");
    __classPrivateFieldSet(this, _EdgeFunctionsRegistry_functionPaths, functionPaths, "f");
}, _EdgeFunctionsRegistry_runBuild = 
/**
 * Thin wrapper for `#runIsolate` that skips running a build and returns an
 * empty response if there are no functions in the registry.
 */
async function _EdgeFunctionsRegistry_runBuild() {
    if (__classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "a", _EdgeFunctionsRegistry_functions_get).length === 0) {
        return {
            functionsConfig: [],
            graph: {
                modules: [],
            },
            npmSpecifiersWithExtraneousFiles: [],
            success: true,
        };
    }
    const { functionsConfig, graph, npmSpecifiersWithExtraneousFiles, success } = await __classPrivateFieldGet(this, _EdgeFunctionsRegistry_runIsolate, "f").call(this, __classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "a", _EdgeFunctionsRegistry_functions_get), __classPrivateFieldGet(this, _EdgeFunctionsRegistry_env, "f"), {
        getFunctionsConfig: true,
    });
    return { functionsConfig, graph, npmSpecifiersWithExtraneousFiles, success };
}, _EdgeFunctionsRegistry_scanForFunctions = 
/**
 * @returns {Promise<{all: EdgeFunction[], new: EdgeFunction[], deleted: EdgeFunction[]}>}
 */
async function _EdgeFunctionsRegistry_scanForFunctions() {
    const [internalFunctions, userFunctions] = await Promise.all([
        __classPrivateFieldGet(this, _EdgeFunctionsRegistry_bundler, "f").find(__classPrivateFieldGet(this, _EdgeFunctionsRegistry_internalDirectories, "f")),
        __classPrivateFieldGet(this, _EdgeFunctionsRegistry_bundler, "f").find(__classPrivateFieldGet(this, _EdgeFunctionsRegistry_directories, "f")),
    ]);
    const functions = [...internalFunctions, ...userFunctions];
    const newFunctions = functions.filter((func) => {
        const functionExists = __classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "a", _EdgeFunctionsRegistry_functions_get).some(
        // @ts-expect-error TS(2339) FIXME: Property 'name' does not exist on type 'never'.
        (existingFunc) => func.name === existingFunc.name && func.path === existingFunc.path);
        return !functionExists;
    });
    const deletedFunctions = __classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "a", _EdgeFunctionsRegistry_functions_get).filter((existingFunc) => {
        const functionExists = functions.some(
        // @ts-expect-error TS(2339) FIXME: Property 'name' does not exist on type 'never'.
        (func) => func.name === existingFunc.name && func.path === existingFunc.path);
        return !functionExists;
    });
    __classPrivateFieldSet(this, _EdgeFunctionsRegistry_internalFunctions, internalFunctions, "f");
    __classPrivateFieldSet(this, _EdgeFunctionsRegistry_userFunctions, userFunctions, "f");
    return { all: functions, new: newFunctions, deleted: deletedFunctions };
}, _EdgeFunctionsRegistry_setupWatchers = 
/**
 * @param {string} projectDir
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'projectDir' implicitly has an 'any' typ... Remove this comment to see the full error message
async function _EdgeFunctionsRegistry_setupWatchers(projectDir) {
    if (__classPrivateFieldGet(this, _EdgeFunctionsRegistry_configPath, "f")) {
        // Creating a watcher for the config file. When it changes, we update the
        // declarations and see if we need to register or unregister any functions.
        // @ts-expect-error TS(2345) FIXME: Argument of type '{ onChange: () => Promise<void>;... Remove this comment to see the full error message
        await watchDebounced(__classPrivateFieldGet(this, _EdgeFunctionsRegistry_configPath, "f"), {
            onChange: async () => {
                const newConfig = await __classPrivateFieldGet(this, _EdgeFunctionsRegistry_getUpdatedConfig, "f").call(this);
                __classPrivateFieldSet(this, _EdgeFunctionsRegistry_declarationsFromTOML, __classPrivateFieldGet(EdgeFunctionsRegistry, _a, "m", _EdgeFunctionsRegistry_getDeclarationsFromTOML).call(EdgeFunctionsRegistry, newConfig), "f");
                await __classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "m", _EdgeFunctionsRegistry_checkForAddedOrDeletedFunctions).call(this);
            },
        });
    }
    // While functions are guaranteed to be inside one of the configured
    // directories, they might be importing files that are located in
    // parent directories. So we watch the entire project directory for
    // changes.
    await __classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "m", _EdgeFunctionsRegistry_setupWatcherForDirectory).call(this, projectDir);
}, _EdgeFunctionsRegistry_setupWatcherForDirectory = 
/**
 * @param {string} directory
 * @returns {Promise<void>}
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'directory' implicitly has an 'any' type... Remove this comment to see the full error message
async function _EdgeFunctionsRegistry_setupWatcherForDirectory(directory) {
    const ignored = [`${__classPrivateFieldGet(this, _EdgeFunctionsRegistry_servePath, "f")}/**`];
    const watcher = await watchDebounced(directory, {
        // @ts-expect-error TS(2322) FIXME: Type 'string[]' is not assignable to type 'never[]... Remove this comment to see the full error message
        ignored,
        onAdd: () => __classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "m", _EdgeFunctionsRegistry_checkForAddedOrDeletedFunctions).call(this),
        // @ts-expect-error TS(2322) FIXME: Type '(paths: any) => Promise<void>' is not assign... Remove this comment to see the full error message
        onChange: (paths) => __classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "m", _EdgeFunctionsRegistry_handleFileChange).call(this, paths),
        onUnlink: () => __classPrivateFieldGet(this, _EdgeFunctionsRegistry_instances, "m", _EdgeFunctionsRegistry_checkForAddedOrDeletedFunctions).call(this),
    });
    __classPrivateFieldGet(this, _EdgeFunctionsRegistry_directoryWatchers, "f").set(directory, watcher);
}, _EdgeFunctionsRegistry_getDisplayName = function _EdgeFunctionsRegistry_getDisplayName(func) {
    const declarations = [...__classPrivateFieldGet(this, _EdgeFunctionsRegistry_declarationsFromTOML, "f"), ...__classPrivateFieldGet(this, _EdgeFunctionsRegistry_declarationsFromDeployConfig, "f")];
    return declarations.find((declaration) => declaration.function === func)?.name ?? func;
};
