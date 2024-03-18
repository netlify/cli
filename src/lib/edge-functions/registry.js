import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { NETLIFYDEVERR, NETLIFYDEVLOG, NETLIFYDEVWARN, nonNullable, chalk, log, warn, watchDebounced, isNodeError, } from '../../utils/command-helpers.js';
import { MultiMap } from '../../utils/multimap.js';
import { getPathInProject } from '../settings.js';
import { INTERNAL_EDGE_FUNCTIONS_FOLDER } from './consts.js';
import { NetlifyLog } from '../../utils/styles/index.js';
const featureFlags = { edge_functions_correct_order: true };
/**
 * Helper method which, given a edge bundler graph module and an index of modules by path, traverses its dependency tree
 * and returns an array of all of ist local dependencies
 */
function traverseLocalDependencies({ dependencies = [] }, modulesByPath) {
    return dependencies.flatMap((dependency) => {
        // We're interested in tracking local dependencies, so we only look at
        // specifiers with the `file:` protocol.
        if (dependency.code === undefined ||
            typeof dependency.code.specifier !== 'string' ||
            !dependency.code.specifier.startsWith('file://')) {
            return [];
        }
        const { specifier: dependencyURL } = dependency.code;
        const dependencyPath = fileURLToPath(dependencyURL);
        const dependencyModule = modulesByPath.get(dependencyPath);
        // No module indexed for this dependency
        if (dependencyModule === undefined) {
            return [dependencyPath];
        }
        // Keep traversing the child dependencies and return the current dependency path
        return [...traverseLocalDependencies(dependencyModule, modulesByPath), dependencyPath];
    });
}
export class EdgeFunctionsRegistry {
    constructor({ bundler, config, configPath, directories, env, getUpdatedConfig, importMapFromTOML, projectDir, runIsolate, servePath, }) {
        this.buildError = null;
        this.declarationsFromDeployConfig = [];
        // Mapping file URLs to names of functions that use them as dependencies.
        this.dependencyPaths = new MultiMap();
        this.directoryWatchers = new Map();
        this.userFunctions = [];
        this.internalFunctions = [];
        // a Map from `this.functions` that maps function paths to function
        // names. This allows us to match modules against functions in O(1) time as
        // opposed to O(n).
        this.functionPaths = new Map();
        this.manifest = null;
        this.routes = [];
        this.bundler = bundler;
        this.configPath = configPath;
        this.directories = directories;
        this.getUpdatedConfig = getUpdatedConfig;
        this.runIsolate = runIsolate;
        this.servePath = servePath;
        this.projectDir = projectDir;
        this.importMapFromTOML = importMapFromTOML;
        this.declarationsFromTOML = EdgeFunctionsRegistry.getDeclarationsFromTOML(config);
        this.env = EdgeFunctionsRegistry.getEnvironmentVariables(env);
        this.initialScan = this.doInitialScan();
        this.setupWatchers();
    }
    async doInitialScan() {
        await this.scanForFunctions();
        try {
            const { warnings } = await this.build();
            this.functions.forEach((func) => {
                this.logEvent('loaded', { functionName: func.name, warnings: warnings[func.name] });
            });
        }
        catch {
            // no-op
        }
    }
    get functions() {
        return [...this.internalFunctions, ...this.userFunctions];
    }
    async build() {
        const warnings = {};
        try {
            const { functionsConfig, graph, npmSpecifiersWithExtraneousFiles, success } = await this.runBuild();
            if (!success) {
                throw new Error('Build error');
            }
            this.buildError = null;
            // We use one index to loop over both internal and user function, because we know that this.#functions has internalFunctions first.
            // functionsConfig therefore contains first all internal functionConfigs and then user functionConfigs
            let index = 0;
            const internalFunctionConfigs = this.internalFunctions.reduce(
            // eslint-disable-next-line no-plusplus
            (acc, func) => ({ ...acc, [func.name]: functionsConfig[index++] }), {});
            const userFunctionConfigs = this.userFunctions.reduce(
            // eslint-disable-next-line no-plusplus
            (acc, func) => ({ ...acc, [func.name]: functionsConfig[index++] }), {});
            const { manifest, routes, unroutedFunctions } = this.buildRoutes(internalFunctionConfigs, userFunctionConfigs);
            this.manifest = manifest;
            this.routes = routes;
            unroutedFunctions.forEach((name) => {
                warnings[name] = warnings[name] || [];
                warnings[name].push(`Edge function is not accessible because it does not have a path configured. Learn more at https://ntl.fyi/edge-create.`);
            });
            for (const functionName in userFunctionConfigs) {
                if ('paths' in userFunctionConfigs[functionName]) {
                    warnings[functionName] = warnings[functionName] || [];
                    warnings[functionName].push(`Unknown 'paths' configuration property. Did you mean 'path'?`);
                }
            }
            this.processGraph(graph);
            if (npmSpecifiersWithExtraneousFiles.length !== 0) {
                const modules = npmSpecifiersWithExtraneousFiles.map((name) => chalk.yellow(name)).join(', ');
                log(`${NETLIFYDEVWARN} The following npm modules, which are directly or indirectly imported by an edge function, may not be supported: ${modules}. For more information, visit https://ntl.fyi/edge-functions-npm.`);
            }
            return { warnings };
        }
        catch (error) {
            if (error instanceof Error) {
                this.buildError = error;
            }
            throw error;
        }
    }
    /**
     * Builds a manifest and corresponding routes for the functions in the
     * registry, taking into account the declarations from the TOML, from
     * the deploy configuration API, and from the in-source configuration
     * found in both internal and user functions.
     */
    buildRoutes(internalFunctionConfigs, userFunctionConfigs) {
        const declarations = this.bundler.mergeDeclarations(this.declarationsFromTOML, userFunctionConfigs, internalFunctionConfigs, this.declarationsFromDeployConfig, featureFlags);
        const { declarationsWithoutFunction, manifest, unroutedFunctions } = this.bundler.generateManifest({
            declarations,
            userFunctionConfig: userFunctionConfigs,
            internalFunctionConfig: internalFunctionConfigs,
            functions: this.functions,
            featureFlags,
        });
        const routes = [...manifest.routes, ...manifest.post_cache_routes].map((route) => ({
            ...route,
            pattern: new RegExp(route.pattern),
        }));
        return { declarationsWithoutFunction, manifest, routes, unroutedFunctions };
    }
    async checkForAddedOrDeletedFunctions() {
        const { deleted: deletedFunctions, new: newFunctions } = await this.scanForFunctions();
        if (newFunctions.length === 0 && deletedFunctions.length === 0) {
            return;
        }
        try {
            const { warnings } = await this.build();
            deletedFunctions.forEach((func) => {
                this.logEvent('removed', { functionName: func.name, warnings: warnings[func.name] });
            });
            newFunctions.forEach((func) => {
                this.logEvent('loaded', { functionName: func.name, warnings: warnings[func.name] });
            });
        }
        catch {
            // no-op
        }
    }
    static getDeclarationsFromTOML(config) {
        const { edge_functions: edgeFunctions = [] } = config;
        return edgeFunctions;
    }
    getDisplayName(func) {
        const declarations = [...this.declarationsFromTOML, ...this.declarationsFromDeployConfig];
        return declarations.find((declaration) => declaration.function === func)?.name ?? func;
    }
    static getEnvironmentVariables(envConfig) {
        const env = Object.create(null);
        Object.entries(envConfig).forEach(([key, variable]) => {
            if (variable.sources.includes('ui') ||
                variable.sources.includes('account') ||
                variable.sources.includes('addons') ||
                variable.sources.includes('internal') ||
                variable.sources.some((source) => source.startsWith('.env'))) {
                env[key] = variable.value;
            }
        });
        env.DENO_REGION = 'local';
        return env;
    }
    async handleFileChange(paths) {
        const matchingFunctions = new Set([
            ...paths.map((path) => this.functionPaths.get(path)),
            ...paths.flatMap((path) => this.dependencyPaths.get(path)),
        ].filter(nonNullable));
        // If the file is not associated with any function, there's no point in
        // building. However, it might be that the path is in fact associated with
        // a function but we just haven't registered it due to a build error. So if
        // there was a build error, let's always build.
        if (matchingFunctions.size === 0 && this.buildError === null) {
            return;
        }
        this.logEvent('reloading', {});
        try {
            const { warnings } = await this.build();
            const functionNames = [...matchingFunctions];
            if (functionNames.length === 0) {
                this.logEvent('reloaded', {});
            }
            else {
                functionNames.forEach((functionName) => {
                    this.logEvent('reloaded', { functionName, warnings: warnings[functionName] });
                });
            }
        }
        catch (error) {
            if (isNodeError(error)) {
                this.logEvent('buildError', { buildError: error });
            }
        }
    }
    async initialize() {
        return await this.initialScan;
    }
    /**
     * Logs an event associated with functions.
     */
    logEvent(event, { buildError, functionName, warnings = [] }) {
        const subject = functionName ? `edge function ${chalk.yellow(this.getDisplayName(functionName))}` : 'edge functions';
        const warningsText = warnings.length === 0 ? '' : ` with warnings:\n${warnings.map((warning) => `  - ${warning}`).join('\n')}`;
        if (event === 'buildError') {
            NetlifyLog.error(`${NETLIFYDEVERR} ${chalk.red('Failed to load')} ${subject}: ${buildError}`, { exit: true });
            return;
        }
        if (event === 'loaded') {
            const icon = warningsText ? NETLIFYDEVWARN : NETLIFYDEVLOG;
            const color = warningsText ? chalk.yellow : chalk.green;
            NetlifyLog.info(`${icon} ${color('Loaded')} ${subject}${warningsText}`);
            return;
        }
        if (event === 'reloaded') {
            const icon = warningsText ? NETLIFYDEVWARN : NETLIFYDEVLOG;
            const color = warningsText ? chalk.yellow : chalk.green;
            NetlifyLog.info(`${icon} ${color('Reloaded')} ${subject}${warningsText}`);
            return;
        }
        if (event === 'reloading') {
            NetlifyLog.info(`${NETLIFYDEVLOG} ${chalk.magenta('Reloading')} ${subject}...`);
            return;
        }
        if (event === 'removed') {
            NetlifyLog.info(`${NETLIFYDEVLOG} ${chalk.magenta('Removed')} ${subject}`);
        }
    }
    /**
     * Returns the functions in the registry that should run for a given URL path
     * and HTTP method, based on the routes registered for each function.
     */
    matchURLPath(urlPath, method) {
        const functionNames = [];
        const routeIndexes = [];
        this.routes.forEach((route, index) => {
            if (route.methods && route.methods.length !== 0 && !route.methods.includes(method)) {
                return;
            }
            if (!route.pattern.test(urlPath)) {
                return;
            }
            const isExcluded = this.manifest?.function_config[route.function]?.excluded_patterns?.some((pattern) => new RegExp(pattern).test(urlPath));
            if (isExcluded) {
                return;
            }
            functionNames.push(route.function);
            routeIndexes.push(index);
        });
        const routes = [...(this.manifest?.routes || []), ...(this.manifest?.post_cache_routes || [])].map((route) => ({
            function: route.function,
            path: route.path,
            pattern: route.pattern,
        }));
        const invocationMetadata = {
            function_config: this.manifest?.function_config,
            req_routes: routeIndexes,
            routes,
        };
        return { functionNames, invocationMetadata };
    }
    /**
     * Takes the module graph returned from the server and tracks dependencies of
     * each function.
     */
    processGraph(graph) {
        if (!graph) {
            if (this.functions.length !== 0) {
                warn('Could not process edge functions dependency graph. Live reload will not be available.');
            }
            return;
        }
        this.dependencyPaths = new MultiMap();
        // Mapping file URLs to modules. Used by the traversal function.
        const modulesByPath = new Map();
        // a set of edge function modules that we'll use to start traversing the dependency tree from
        const functionModules = new Set();
        graph.modules.forEach((module) => {
            // We're interested in tracking local dependencies, so we only look at
            // specifiers with the `file:` protocol.
            const { specifier } = module;
            if (!specifier.startsWith('file://')) {
                return;
            }
            const path = fileURLToPath(specifier);
            modulesByPath.set(path, module);
            const functionName = this.functionPaths.get(path);
            if (functionName) {
                functionModules.add({ functionName, module });
            }
        });
        // We start from our functions and we traverse through their dependency tree
        functionModules.forEach(({ functionName, module }) => {
            const traversedPaths = traverseLocalDependencies(module, modulesByPath);
            traversedPaths.forEach((dependencyPath) => {
                this.dependencyPaths.add(dependencyPath, functionName);
            });
        });
    }
    /**
     * Thin wrapper for `#runIsolate` that skips running a build and returns an
     * empty response if there are no functions in the registry.
     */
    async runBuild() {
        if (this.functions.length === 0) {
            return {
                functionsConfig: [],
                npmSpecifiersWithExtraneousFiles: [],
                success: true,
            };
        }
        const { functionsConfig, graph, npmSpecifiersWithExtraneousFiles, success } = await this.runIsolate(this.functions, this.env, {
            getFunctionsConfig: true,
            importMapPaths: [this.importMapFromTOML, this.importMapFromDeployConfig].filter(nonNullable),
        });
        return { functionsConfig, graph, npmSpecifiersWithExtraneousFiles, success };
    }
    get internalDirectory() {
        return join(this.projectDir, getPathInProject([INTERNAL_EDGE_FUNCTIONS_FOLDER]));
    }
    async readDeployConfig() {
        const manifestPath = join(this.internalDirectory, 'manifest.json');
        try {
            const contents = await readFile(manifestPath, 'utf8');
            const manifest = JSON.parse(contents);
            return manifest;
        }
        catch { }
    }
    async scanForDeployConfig() {
        const deployConfig = await this.readDeployConfig();
        if (!deployConfig) {
            return;
        }
        if (deployConfig.version !== 1) {
            throw new Error('Unsupported manifest format');
        }
        this.declarationsFromDeployConfig = deployConfig.functions;
        this.importMapFromDeployConfig = deployConfig.import_map
            ? join(this.internalDirectory, deployConfig.import_map)
            : undefined;
    }
    async scanForFunctions() {
        const [internalFunctions, userFunctions] = await Promise.all([
            this.bundler.find([this.internalDirectory]),
            this.bundler.find(this.directories),
            this.scanForDeployConfig(),
        ]);
        const functions = [...internalFunctions, ...userFunctions];
        const newFunctions = functions.filter((func) => {
            const functionExists = this.functions.some((existingFunc) => func.name === existingFunc.name && func.path === existingFunc.path);
            return !functionExists;
        });
        const deletedFunctions = this.functions.filter((existingFunc) => {
            const functionExists = functions.some((func) => func.name === existingFunc.name && func.path === existingFunc.path);
            return !functionExists;
        });
        this.internalFunctions = internalFunctions;
        this.userFunctions = userFunctions;
        // eslint-disable-next-line unicorn/prefer-spread
        this.functionPaths = new Map(Array.from(this.functions, (func) => [func.path, func.name]));
        return { all: functions, new: newFunctions, deleted: deletedFunctions };
    }
    async setupWatchers() {
        // While functions are guaranteed to be inside one of the configured
        // directories, they might be importing files that are located in
        // parent directories. So we watch the entire project directory for
        // changes.
        await this.setupWatcherForDirectory();
        if (!this.configPath) {
            return;
        }
        // Creating a watcher for the config file. When it changes, we update the
        // declarations and see if we need to register or unregister any functions.
        await watchDebounced(this.configPath, {
            onChange: async () => {
                const newConfig = await this.getUpdatedConfig();
                this.declarationsFromTOML = EdgeFunctionsRegistry.getDeclarationsFromTOML(newConfig);
                await this.checkForAddedOrDeletedFunctions();
            },
        });
    }
    async setupWatcherForDirectory() {
        const ignored = [`${this.servePath}/**`];
        const watcher = await watchDebounced(this.projectDir, {
            ignored,
            onAdd: () => this.checkForAddedOrDeletedFunctions(),
            onChange: (paths) => this.handleFileChange(paths),
            onUnlink: () => this.checkForAddedOrDeletedFunctions(),
        });
        this.directoryWatchers.set(this.projectDir, watcher);
    }
}
