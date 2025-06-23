import process from 'process';
import { BLOBS_CONTEXT_VARIABLE, encodeBlobsContext, getBlobsContextWithAPIAccess, getBlobsContextWithEdgeAccess, } from '../../lib/blobs/blobs.js';
import { promptEditorHelper } from '../../lib/edge-functions/editor-helper.js';
import { startFunctionsServer } from '../../lib/functions/server.js';
import { printBanner } from '../../utils/dev-server-banner.js';
import { NETLIFYDEVERR, NETLIFYDEVLOG, NETLIFYDEVWARN, chalk, exit, log, normalizeConfig, } from '../../utils/command-helpers.js';
import detectServerSettings, { getConfigWithPlugins } from '../../utils/detect-server-settings.js';
import { UNLINKED_SITE_MOCK_ID, getDotEnvVariables, getSiteInformation, injectEnvVariables } from '../../utils/dev.js';
import { getEnvelopeEnv } from '../../utils/env/index.js';
import { getFrameworksAPIConfig } from '../../utils/frameworks-api.js';
import { getInternalFunctionsDir } from '../../utils/functions/functions.js';
import { ensureNetlifyIgnore } from '../../utils/gitignore.js';
import openBrowser from '../../utils/open-browser.js';
import { generateInspectSettings, startProxyServer } from '../../utils/proxy-server.js';
import { runBuildTimeline } from '../../utils/run-build.js';
export const serve = async (options, command) => {
    const { api, cachedConfig, config, frameworksAPIPaths, repositoryRoot, site, siteInfo, state } = command.netlify;
    config.dev = config.dev != null ? { ...config.dev } : undefined;
    config.build = { ...config.build };
    const devConfig = {
        ...(config.functionsDirectory && { functions: config.functionsDirectory }),
        ...('publish' in config.build && config.build.publish && { publish: config.build.publish }),
        ...config.dev,
        ...options,
        // Override the `framework` value so that we start a static server and not
        // the framework's development server.
        framework: '#static',
    };
    let { env } = cachedConfig;
    if (!options.offline) {
        env = await getEnvelopeEnv({ api, context: options.context, env, siteInfo });
        log(`${NETLIFYDEVLOG} Injecting environment variable values for ${chalk.yellow('all scopes')}`);
    }
    env = await getDotEnvVariables({ devConfig, env, site });
    injectEnvVariables(env);
    await promptEditorHelper({ chalk, config, log, NETLIFYDEVLOG, repositoryRoot, state });
    const { accountId, addonsUrls, capabilities, siteUrl, timeouts } = await getSiteInformation({
        // inherited from base command --offline
        offline: options.offline,
        api,
        site,
        siteInfo,
    });
    if (!site.root) {
        throw new Error('Site root not found');
    }
    // Ensure the internal functions directory exists so that the functions
    // server and registry are initialized, and any functions created by
    // Netlify Build are loaded.
    await getInternalFunctionsDir({
        base: site.root,
        ensureExists: true,
        packagePath: command.workspacePackage,
    });
    await frameworksAPIPaths.functions.ensureExists();
    let settings;
    try {
        settings = await detectServerSettings(devConfig, options, command);
        cachedConfig.config = getConfigWithPlugins(cachedConfig.config, settings);
    }
    catch (error_) {
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        log(NETLIFYDEVERR, error_.message);
        return exit(1);
    }
    command.setAnalyticsPayload({ live: options.live });
    log(`${NETLIFYDEVLOG} Building project for production`);
    log(`${NETLIFYDEVWARN} Changes will not be hot-reloaded, so if you need to rebuild your project you must exit and run 'netlify serve' again`);
    const blobsOptions = {
        debug: options.debug,
        projectRoot: command.workingDir,
        siteID: site.id ?? UNLINKED_SITE_MOCK_ID,
    };
    // We start by running a build, so we want a Blobs context with API access,
    // which is what build plugins use.
    process.env[BLOBS_CONTEXT_VARIABLE] = encodeBlobsContext(await getBlobsContextWithAPIAccess(blobsOptions));
    const { configPath: configPathOverride } = await runBuildTimeline({
        command,
        settings,
        options,
        env: {},
    });
    const mergedConfig = await getFrameworksAPIConfig(config, frameworksAPIPaths.config.path);
    // Now we generate a second Blobs context object, this time with edge access
    // for runtime access (i.e. from functions and edge functions).
    const runtimeBlobsContext = await getBlobsContextWithEdgeAccess(blobsOptions);
    process.env[BLOBS_CONTEXT_VARIABLE] = encodeBlobsContext(runtimeBlobsContext);
    const functionsRegistry = await startFunctionsServer({
        blobsContext: runtimeBlobsContext,
        command,
        config: mergedConfig,
        debug: options.debug,
        loadDistFunctions: true,
        settings,
        site,
        siteInfo,
        siteUrl,
        capabilities,
        timeouts,
        geolocationMode: options.geo,
        geoCountry: options.country,
        offline: options.offline,
        state,
        accountId,
    });
    // Try to add `.netlify` to `.gitignore`.
    try {
        await ensureNetlifyIgnore(repositoryRoot);
    }
    catch {
        // no-op
    }
    // TODO: We should consolidate this with the existing config watcher.
    const getUpdatedConfig = async () => {
        const { config: newConfig } = await command.getConfig({ cwd: command.workingDir, offline: true });
        const normalizedNewConfig = normalizeConfig(newConfig);
        return normalizedNewConfig;
    };
    const inspectSettings = generateInspectSettings(options.edgeInspect, options.edgeInspectBrk);
    const url = await startProxyServer({
        addonsUrls,
        blobsContext: runtimeBlobsContext,
        command,
        config: mergedConfig,
        configPath: configPathOverride,
        debug: options.debug,
        disableEdgeFunctions: options.internalDisableEdgeFunctions,
        env,
        functionsRegistry,
        geolocationMode: options.geo,
        geoCountry: options.country,
        getUpdatedConfig,
        inspectSettings,
        offline: options.offline,
        projectDir: command.workingDir,
        settings,
        site,
        siteInfo,
        state,
        accountId,
    });
    if (devConfig.autoLaunch !== false) {
        await openBrowser({ url, silentBrowserNoneError: true });
    }
    process.env.URL = url;
    process.env.DEPLOY_URL = url;
    printBanner({ url });
};
//# sourceMappingURL=serve.js.map