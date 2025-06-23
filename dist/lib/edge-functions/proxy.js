import { Buffer } from 'buffer';
import { rm } from 'fs/promises';
import { join, resolve } from 'path';
import * as bundler from '@netlify/edge-bundler';
import getAvailablePort from 'get-port';
import { NETLIFYDEVERR, chalk, logAndThrowError, } from '../../utils/command-helpers.js';
import { getFeatureFlagsFromSiteInfo } from '../../utils/feature-flags.js';
import { getGeoLocation } from '../geo-location.js';
import { getPathInProject } from '../settings.js';
import { startSpinner, stopSpinner } from '../spinner.js';
import { getBootstrapURL } from './bootstrap.js';
import { DIST_IMPORT_MAP_PATH, EDGE_FUNCTIONS_SERVE_FOLDER } from './consts.js';
import { getFeatureFlagsHeader, getInvocationMetadataHeader, headers } from './headers.js';
import { EdgeFunctionsRegistry } from './registry.js';
const headersSymbol = Symbol('Edge Functions Headers');
const LOCAL_HOST = '127.0.0.1';
const getDownloadUpdateFunctions = () => {
    let spinner;
    const onAfterDownload = (error_) => {
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
const createAccountInfoHeader = ({ id }) => {
    const account = { id };
    const accountString = JSON.stringify(account);
    return Buffer.from(accountString).toString('base64');
};
export const initializeProxy = async ({ accountId, blobsContext, command, config, configPath, debug, env: configEnv, geoCountry, geolocationMode, getUpdatedConfig, inspectSettings, mainPort, offline, passthroughPort, projectDir, repositoryRoot, settings, siteInfo, state, }) => {
    const userFunctionsPath = config.build.edge_functions;
    const isolatePort = await getAvailablePort();
    const runtimeFeatureFlags = ['edge_functions_bootstrap_failure_mode', 'edge_functions_bootstrap_populate_environment'];
    const protocol = settings.https ? 'https' : 'http';
    const buildFeatureFlags = { ...getFeatureFlagsFromSiteInfo(siteInfo), edge_functions_npm_modules: true };
    // Initializes the server, bootstrapping the Deno CLI and downloading it from
    // the network if needed. We don't want to wait for that to be completed, or
    // the command will be left hanging.
    const server = prepareServer({
        command,
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
        req.headers[headers.DeployContext] = 'dev';
        req.headers[headers.Site] = createSiteInfoHeader(siteInfo, `${protocol}://localhost:${mainPort}`);
        req.headers[headers.Account] = createAccountInfoHeader({ id: accountId });
        if (blobsContext?.edgeURL && blobsContext?.token) {
            req.headers[headers.BlobsInfo] = Buffer.from(JSON.stringify({ url: blobsContext.edgeURL, url_uncached: blobsContext.edgeURL, token: blobsContext.token })).toString('base64');
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
export const isEdgeFunctionsRequest = (req) => Object.hasOwn(req, headersSymbol);
const prepareServer = async ({ command, config, configPath, debug, directory, env: configEnv, featureFlags, getUpdatedConfig, inspectSettings, port, projectDir, repositoryRoot, }) => {
    try {
        const distImportMapPath = getPathInProject([DIST_IMPORT_MAP_PATH]);
        const servePath = resolve(projectDir, command.getPathInProject(EDGE_FUNCTIONS_SERVE_FOLDER));
        await rm(servePath, { force: true, recursive: true });
        const runIsolate = await bundler.serve({
            ...getDownloadUpdateFunctions(),
            basePath: projectDir,
            bootstrapURL: await getBootstrapURL(),
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
            command,
            bundler,
            config,
            configPath,
            debug,
            directories: directory ? [directory] : [],
            env: configEnv,
            featureFlags,
            getUpdatedConfig,
            importMapFromTOML: config.functions?.['*'].deno_import_map,
            projectDir,
            runIsolate,
            servePath,
        });
        return registry;
    }
    catch (error) {
        return logAndThrowError(error instanceof Error ? error.message : error?.toString());
    }
};
//# sourceMappingURL=proxy.js.map