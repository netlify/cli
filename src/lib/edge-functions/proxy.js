import { Buffer } from 'buffer';
import { rm } from 'fs/promises';
import { join, resolve } from 'path';
import * as bundler from '@netlify/edge-bundler';
import getAvailablePort from 'get-port';
import { NETLIFYDEVERR, chalk, error as printError } from '../../utils/command-helpers.js';
import { getGeoLocation } from '../geo-location.js';
import { getPathInProject } from '../settings.js';
import { startSpinner, stopSpinner } from '../spinner.js';
import { getBootstrapURL } from './bootstrap.js';
import { DIST_IMPORT_MAP_PATH, EDGE_FUNCTIONS_SERVE_FOLDER } from './consts.js';
import { headers, getFeatureFlagsHeader, getInvocationMetadataHeader } from './headers.js';
import { EdgeFunctionsRegistry } from './registry.js';
const headersSymbol = Symbol('Edge Functions Headers');
const LOCAL_HOST = '127.0.0.1';
const getDownloadUpdateFunctions = () => {
    // @ts-expect-error TS(7034) FIXME: Variable 'spinner' implicitly has type 'any' in so... Remove this comment to see the full error message
    let spinner;
    /**
     * @param {Error=} error_
     */
    // @ts-expect-error TS(7006) FIXME: Parameter 'error_' implicitly has an 'any' type.
    const onAfterDownload = (error_) => {
        // @ts-expect-error TS(2345) FIXME: Argument of type '{ error: boolean; spinner: any; ... Remove this comment to see the full error message
        stopSpinner({ error: Boolean(error_), spinner });
    };
    const onBeforeDownload = () => {
        spinner = startSpinner({ text: 'Setting up the Edge Functions environment. This may take a couple of minutes.' });
    };
    return {
        onAfterDownload,
        onBeforeDownload,
    };
};
// @ts-expect-error TS(7006) FIXME: Parameter 'req' implicitly has an 'any' type.
export const handleProxyRequest = (req, proxyReq) => {
    Object.entries(req[headersSymbol]).forEach(([header, value]) => {
        proxyReq.setHeader(header, value);
    });
};
export const createSiteInfoHeader = (siteInfo, localURL) => {
    const { id, name, url } = siteInfo;
    const site = { id, name, url: localURL ?? url };
    const siteString = JSON.stringify(site);
    return Buffer.from(siteString).toString('base64');
};
export const createAccountInfoHeader = (accountInfo = {}) => {
    // @ts-expect-error TS(2339) FIXME: Property 'id' does not exist on type '{}'.
    const { id } = accountInfo;
    const account = { id };
    const accountString = JSON.stringify(account);
    return Buffer.from(accountString).toString('base64');
};
/**
 *
 * @param {object} config
 * @param {*} config.accountId
 * @param {import("../blobs/blobs.js").BlobsContext} config.blobsContext
 * @param {*} config.config
 * @param {*} config.configPath
 * @param {*} config.debug
 * @param {*} config.env
 * @param {*} config.geoCountry
 * @param {*} config.geolocationMode
 * @param {*} config.getUpdatedConfig
 * @param {*} config.inspectSettings
 * @param {*} config.mainPort
 * @param {boolean=} config.offline
 * @param {*} config.passthroughPort
 * @param {*} config.projectDir
 * @param {*} config.settings
 * @param {*} config.siteInfo
 * @param {*} config.state
 * @returns
 */
export const initializeProxy = async ({ 
// @ts-expect-error TS(7031) FIXME: Binding element 'accountId' implicitly has an 'any... Remove this comment to see the full error message
accountId, 
// @ts-expect-error TS(7031) FIXME: Binding element 'blobsContext' implicitly has an '... Remove this comment to see the full error message
blobsContext, 
// @ts-expect-error TS(7031) FIXME: Binding element 'config' implicitly has an 'any' t... Remove this comment to see the full error message
config, 
// @ts-expect-error TS(7031) FIXME: Binding element 'configPath' implicitly has an 'an... Remove this comment to see the full error message
configPath, 
// @ts-expect-error TS(7031) FIXME: Binding element 'debug' implicitly has an 'any' ty... Remove this comment to see the full error message
debug, 
// @ts-expect-error TS(7031) FIXME: Binding element 'configEnv' implicitly has an 'any... Remove this comment to see the full error message
env: configEnv, 
// @ts-expect-error TS(7031) FIXME: Binding element 'geoCountry' implicitly has an 'an... Remove this comment to see the full error message
geoCountry, 
// @ts-expect-error TS(7031) FIXME: Binding element 'geolocationMode' implicitly has a... Remove this comment to see the full error message
geolocationMode, 
// @ts-expect-error TS(7031) FIXME: Binding element 'getUpdatedConfig' implicitly has ... Remove this comment to see the full error message
getUpdatedConfig, 
// @ts-expect-error TS(7031) FIXME: Binding element 'inspectSettings' implicitly has a... Remove this comment to see the full error message
inspectSettings, 
// @ts-expect-error TS(7031) FIXME: Binding element 'mainPort' implicitly has an 'any'... Remove this comment to see the full error message
mainPort, 
// @ts-expect-error TS(7031) FIXME: Binding element 'offline' implicitly has an 'any' ... Remove this comment to see the full error message
offline, 
// @ts-expect-error TS(7031) FIXME: Binding element 'passthroughPort' implicitly has a... Remove this comment to see the full error message
passthroughPort, 
// @ts-expect-error TS(7031) FIXME: Binding element 'projectDir' implicitly has an 'an... Remove this comment to see the full error message
projectDir, 
// @ts-expect-error TS(7031) FIXME: Binding element 'repositoryRoot' implicitly has an... Remove this comment to see the full error message
repositoryRoot, 
// @ts-expect-error TS(7031) FIXME: Binding element 'settings' implicitly has an 'any'... Remove this comment to see the full error message
settings, 
// @ts-expect-error TS(7031) FIXME: Binding element 'siteInfo' implicitly has an 'any'... Remove this comment to see the full error message
siteInfo, 
// @ts-expect-error TS(7031) FIXME: Binding element 'state' implicitly has an 'any' ty... Remove this comment to see the full error message
state, }) => {
    const userFunctionsPath = config.build.edge_functions;
    const isolatePort = await getAvailablePort();
    const buildFeatureFlags = {
        edge_functions_npm_modules: true,
    };
    const runtimeFeatureFlags = ['edge_functions_bootstrap_failure_mode', 'edge_functions_bootstrap_populate_environment'];
    const protocol = settings.https ? 'https' : 'http';
    // Initializes the server, bootstrapping the Deno CLI and downloading it from
    // the network if needed. We don't want to wait for that to be completed, or
    // the command will be left hanging.
    const server = prepareServer({
        config,
        configPath,
        debug,
        directory: userFunctionsPath,
        env: configEnv,
        featureFlags: buildFeatureFlags,
        getUpdatedConfig,
        inspectSettings,
        port: isolatePort,
        projectDir,
        repositoryRoot,
    });
    return async (req) => {
        if (req.headers[headers.Passthrough] !== undefined) {
            return;
        }
        const [geoLocation, registry] = await Promise.all([
            getGeoLocation({ mode: geolocationMode, geoCountry, offline, state }),
            server,
        ]);
        if (!registry)
            return;
        // Setting header with geolocation and site info.
        req.headers[headers.Geo] = Buffer.from(JSON.stringify(geoLocation)).toString('base64');
        req.headers[headers.DeployID] = '0';
        req.headers[headers.Site] = createSiteInfoHeader(siteInfo, `${protocol}://localhost:${mainPort}`);
        req.headers[headers.Account] = createAccountInfoHeader({ id: accountId });
        if (blobsContext?.edgeURL && blobsContext?.token) {
            req.headers[headers.BlobsInfo] = Buffer.from(JSON.stringify({ url: blobsContext.edgeURL, token: blobsContext.token })).toString('base64');
        }
        await registry.initialize();
        const url = new URL(req.url, `http://${LOCAL_HOST}:${mainPort}`);
        const { functionNames, invocationMetadata } = registry.matchURLPath(url.pathname, req.method);
        if (functionNames.length === 0) {
            return;
        }
        req[headersSymbol] = {
            [headers.FeatureFlags]: getFeatureFlagsHeader(runtimeFeatureFlags),
            [headers.ForwardedProtocol]: `${protocol}:`,
            [headers.Functions]: functionNames.join(','),
            [headers.InvocationMetadata]: getInvocationMetadataHeader(invocationMetadata),
            [headers.IP]: LOCAL_HOST,
            [headers.Passthrough]: 'passthrough',
            [headers.PassthroughHost]: `localhost:${passthroughPort}`,
            [headers.PassthroughProtocol]: 'http:',
        };
        if (debug) {
            req[headersSymbol][headers.DebugLogging] = '1';
        }
        return `http://${LOCAL_HOST}:${isolatePort}`;
    };
};
// @ts-expect-error TS(7006) FIXME: Parameter 'req' implicitly has an 'any' type.
export const isEdgeFunctionsRequest = (req) => req[headersSymbol] !== undefined;
const prepareServer = async ({ 
// @ts-expect-error TS(7031) FIXME: Binding element 'config' implicitly has an 'any' t... Remove this comment to see the full error message
config, 
// @ts-expect-error TS(7031) FIXME: Binding element 'configPath' implicitly has an 'an... Remove this comment to see the full error message
configPath, 
// @ts-expect-error TS(7031) FIXME: Binding element 'debug' implicitly has an 'any' ty... Remove this comment to see the full error message
debug, 
// @ts-expect-error TS(7031) FIXME: Binding element 'directory' implicitly has an 'any... Remove this comment to see the full error message
directory, 
// @ts-expect-error TS(7031) FIXME: Binding element 'configEnv' implicitly has an 'any... Remove this comment to see the full error message
env: configEnv, 
// @ts-expect-error TS(7031) FIXME: Binding element 'featureFlags' implicitly has an '... Remove this comment to see the full error message
featureFlags, 
// @ts-expect-error TS(7031) FIXME: Binding element 'getUpdatedConfig' implicitly has ... Remove this comment to see the full error message
getUpdatedConfig, 
// @ts-expect-error TS(7031) FIXME: Binding element 'inspectSettings' implicitly has a... Remove this comment to see the full error message
inspectSettings, 
// @ts-expect-error TS(7031) FIXME: Binding element 'port' implicitly has an 'any' typ... Remove this comment to see the full error message
port, 
// @ts-expect-error TS(7031) FIXME: Binding element 'projectDir' implicitly has an 'an... Remove this comment to see the full error message
projectDir, 
// @ts-expect-error TS(7031) FIXME: Binding element 'repositoryRoot' implicitly has an... Remove this comment to see the full error message
repositoryRoot, }) => {
    try {
        const distImportMapPath = getPathInProject([DIST_IMPORT_MAP_PATH]);
        const servePath = resolve(projectDir, getPathInProject([EDGE_FUNCTIONS_SERVE_FOLDER]));
        await rm(servePath, { force: true, recursive: true });
        const runIsolate = await bundler.serve({
            ...getDownloadUpdateFunctions(),
            basePath: projectDir,
            bootstrapURL: getBootstrapURL(),
            debug,
            distImportMapPath: join(projectDir, distImportMapPath),
            featureFlags,
            formatExportTypeError: (name) => `${NETLIFYDEVERR} ${chalk.red('Failed')} to load Edge Function ${chalk.yellow(name)}. The file does not seem to have a function as the default export.`,
            formatImportError: (name) => `${NETLIFYDEVERR} ${chalk.red('Failed')} to run Edge Function ${chalk.yellow(name)}:`,
            inspectSettings,
            port,
            rootPath: repositoryRoot,
            servePath,
        });
        const registry = new EdgeFunctionsRegistry({
            bundler,
            config,
            configPath,
            debug,
            directories: [directory].filter(Boolean),
            env: configEnv,
            getUpdatedConfig,
            importMapFromTOML: config.functions['*'].deno_import_map,
            projectDir,
            runIsolate,
            servePath,
        });
        return registry;
    }
    catch (error) {
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        printError(error.message, { exit: false });
    }
};
