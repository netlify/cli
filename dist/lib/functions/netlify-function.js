import { Buffer } from 'buffer';
import { basename, extname } from 'path';
import { version as nodeVersion } from 'process';
import CronParser from 'cron-parser';
import semver from 'semver';
import { logAndThrowError } from '../../utils/command-helpers.js';
import { BACKGROUND } from '../../utils/functions/get-functions.js';
import { getBlobsEventProperty } from '../blobs/blobs.js';
const TYPESCRIPT_EXTENSIONS = new Set(['.cts', '.mts', '.ts']);
const V2_MIN_NODE_VERSION = '20.12.2';
// Returns a new set with all elements of `setA` that don't exist in `setB`.
const difference = (setA, setB) => new Set([...setA].filter((item) => !setB.has(item)));
const getNextRun = function (schedule) {
    const cron = CronParser.parseExpression(schedule, {
        tz: 'Etc/UTC',
    });
    return cron.next().toDate();
};
export default class NetlifyFunction {
    blobsContext;
    config;
    directory;
    projectRoot;
    timeoutBackground;
    timeoutSynchronous;
    settings;
    displayName;
    mainFile;
    name;
    runtime;
    schedule;
    // Determines whether this is a background function based on the function
    // name.
    isBackground;
    buildQueue;
    buildData;
    buildError = null;
    // List of the function's source files. This starts out as an empty set
    // and will get populated on every build.
    srcFiles = new Set();
    constructor({ blobsContext, config, directory, displayName, mainFile, name, projectRoot, runtime, settings, timeoutBackground, timeoutSynchronous, }) {
        this.blobsContext = blobsContext;
        this.config = config;
        this.directory = directory;
        this.mainFile = mainFile;
        this.name = name;
        this.displayName = displayName ?? name;
        this.projectRoot = projectRoot;
        this.runtime = runtime;
        this.timeoutBackground = timeoutBackground;
        this.timeoutSynchronous = timeoutSynchronous;
        this.settings = settings;
        this.isBackground = name.endsWith(BACKGROUND);
        const functionConfig = config.functions?.[name];
        // @ts-expect-error -- XXX(serhalp): fixed in stack PR (bumps to https://github.com/netlify/build/pull/6165)
        this.schedule = functionConfig && functionConfig.schedule;
        this.srcFiles = new Set();
    }
    get filename() {
        if (!this.buildData?.mainFile) {
            return null;
        }
        return basename(this.buildData.mainFile);
    }
    getRecommendedExtension() {
        if (this.buildData?.runtimeAPIVersion !== 2) {
            return;
        }
        const extension = this.buildData.mainFile ? extname(this.buildData.mainFile) : undefined;
        const moduleFormat = this.buildData.outputModuleFormat;
        if (moduleFormat === 'esm') {
            return;
        }
        if (extension === '.ts') {
            return '.mts';
        }
        if (extension === '.js') {
            return '.mjs';
        }
    }
    hasValidName() {
        // same as https://github.com/netlify/bitballoon/blob/fbd7881e6c8e8c48e7a0145da4ee26090c794108/app/models/deploy.rb#L482
        return /^[A-Za-z0-9_-]+$/.test(this.name);
    }
    async isScheduled() {
        await this.buildQueue;
        return Boolean(this.schedule);
    }
    isSupported() {
        return !(this.buildData?.runtimeAPIVersion === 2 && semver.lt(nodeVersion, V2_MIN_NODE_VERSION));
    }
    isTypeScript() {
        if (this.filename === null) {
            return false;
        }
        return TYPESCRIPT_EXTENSIONS.has(extname(this.filename));
    }
    async getNextRun() {
        if (!(await this.isScheduled())) {
            return null;
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return getNextRun(this.schedule);
    }
    // The `build` method transforms source files into invocable functions. Its
    // return value is an object with:
    //
    // - `srcFilesDiff`: Files that were added and removed since the last time
    //    the function was built.
    async build({ cache }) {
        const buildFunction = await this.runtime.getBuildFunction({
            config: this.config,
            directory: this.directory,
            errorExit: logAndThrowError,
            func: this,
            projectRoot: this.projectRoot,
        });
        this.buildQueue = buildFunction({ cache });
        try {
            const { includedFiles = [], schedule, srcFiles, ...buildData } = await this.buildQueue;
            const srcFilesSet = new Set(srcFiles);
            const srcFilesDiff = this.getSrcFilesDiff(srcFilesSet);
            this.buildData = buildData;
            this.buildError = null;
            this.srcFiles = srcFilesSet;
            this.schedule = schedule ?? this.schedule;
            if (!this.isSupported()) {
                throw new Error(`Function requires Node.js version ${V2_MIN_NODE_VERSION} or above, but ${nodeVersion.slice(1)} is installed. Refer to https://ntl.fyi/functions-runtime for information on how to update.`);
            }
            return { includedFiles, srcFilesDiff };
        }
        catch (error) {
            if (error instanceof Error) {
                this.buildError = error;
            }
            return { error };
        }
    }
    async getBuildData() {
        await this.buildQueue;
        return this.buildData;
    }
    // Compares a new set of source files against a previous one, returning an
    // object with two Sets, one with added and the other with deleted files.
    getSrcFilesDiff(newSrcFiles) {
        const added = difference(newSrcFiles, this.srcFiles);
        const deleted = difference(this.srcFiles, newSrcFiles);
        return {
            added,
            deleted,
        };
    }
    // Invokes the function and returns its response object.
    async invoke(event = {}, context = {}) {
        await this.buildQueue;
        if (this.buildError) {
            // TODO(serhalp): I don't think this error handling works as expected. Investigate.
            return { result: null, error: { errorType: '', stackTrace: [], errorMessage: this.buildError.message } };
        }
        const timeout = this.isBackground ? this.timeoutBackground : this.timeoutSynchronous;
        if (timeout == null) {
            throw new Error('Function timeout (`timeoutBackground` or `timeoutSynchronous`) not set');
        }
        // Get function environment variables from config.build.environment
        // This allows build event handlers to add function-specific environment variables
        // Only include config environment variables that are not already set in process.env
        // to ensure process environment variables take precedence
        const configEnvVars = {};
        if (this.config.build?.environment) {
            Object.entries(this.config.build.environment).forEach(([key, value]) => {
                if (typeof value === 'string' && !(key in process.env)) {
                    configEnvVars[key] = value;
                }
            });
        }
        const environment = {
            // Include function-specific environment variables from config
            ...configEnvVars,
        };
        if (this.blobsContext) {
            const payload = JSON.stringify(getBlobsEventProperty(this.blobsContext));
            event.blobs = Buffer.from(payload).toString('base64');
        }
        try {
            const result = await this.runtime.invokeFunction({
                context,
                environment,
                event,
                func: this,
                timeout,
            });
            return { result, error: null };
        }
        catch (error) {
            return { result: null, error: error };
        }
    }
    /**
     * Matches all routes agains the incoming request. If a match is found, then the matched route is returned.
     * @returns matched route
     */
    async matchURLPath(rawPath, method, hasStaticFile) {
        await this.buildQueue;
        let path = rawPath !== '/' && rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;
        path = path.toLowerCase();
        const { excludedRoutes = [], routes = [] } = this.buildData ?? {};
        const matchingRoute = routes.find((route) => {
            if (route.methods && route.methods.length !== 0 && !route.methods.includes(method)) {
                return false;
            }
            if ('literal' in route && route.literal !== undefined) {
                return path === route.literal;
            }
            if ('expression' in route && route.expression !== undefined) {
                const regex = new RegExp(route.expression);
                return regex.test(path);
            }
            return false;
        });
        if (!matchingRoute) {
            return;
        }
        const isExcluded = excludedRoutes.some((excludedRoute) => {
            if ('literal' in excludedRoute && excludedRoute.literal !== undefined) {
                return path === excludedRoute.literal;
            }
            if ('expression' in excludedRoute && excludedRoute.expression !== undefined) {
                const regex = new RegExp(excludedRoute.expression);
                return regex.test(path);
            }
            return false;
        });
        if (isExcluded) {
            return;
        }
        if (matchingRoute.prefer_static && (await hasStaticFile())) {
            return;
        }
        return matchingRoute;
    }
    get runtimeAPIVersion() {
        return this.buildData?.runtimeAPIVersion ?? 1;
    }
    get url() {
        // This line fixes the issue here https://github.com/netlify/cli/issues/4116
        // Not sure why `settings.port` was used here nor does a valid reference exist.
        // However, it remains here to serve whatever purpose for which it was added.
        // @ts-expect-error(serhalp) -- Remove use of `port` here? Otherwise, pass it in from `functions:serve`.
        const port = this.settings.port || this.settings.functionsPort;
        // @ts-expect-error(serhalp) -- Same as above for `https`
        const protocol = this.settings.https ? 'https' : 'http';
        const url = new URL(`/.netlify/functions/${this.name}`, `${protocol}://localhost:${port}`);
        return url.href;
    }
}
//# sourceMappingURL=netlify-function.js.map