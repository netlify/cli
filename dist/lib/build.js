import fs from 'fs';
import process from 'process';
import build from '@netlify/build';
import tomlify from 'tomlify-j0.4';
import { getFeatureFlagsFromSiteInfo } from '../utils/feature-flags.js';
import { getBootstrapURL } from './edge-functions/bootstrap.js';
import { featureFlags as edgeFunctionsFeatureFlags } from './edge-functions/consts.js';
// We have already resolved the configuration using `@netlify/config`
// This is stored as `netlify.cachedConfig` and can be passed to
// `@netlify/build --cachedConfig`.
export const getRunBuildOptions = async ({ cachedConfig, currentDir, defaultConfig, deployHandler, options: { context, cwd, debug, dry, json, offline, silent }, packagePath, token, }) => {
    const eventHandlers = {
        onEnd: {
            handler: ({ netlifyConfig }) => {
                const string = tomlify.toToml(netlifyConfig);
                if (!fs.existsSync(`${currentDir}/.netlify`)) {
                    fs.mkdirSync(`${currentDir}/.netlify`, { recursive: true });
                }
                fs.writeFileSync(`${currentDir}/.netlify/netlify.toml`, string);
                return {};
            },
            description: 'Save updated config',
        },
    };
    if (deployHandler) {
        eventHandlers.onPostBuild = {
            handler: deployHandler,
            description: 'Deploy Site',
        };
    }
    return {
        cachedConfig,
        defaultConfig: defaultConfig ?? {},
        siteId: cachedConfig.siteInfo.id,
        accountId: cachedConfig.siteInfo.account_id,
        packagePath,
        token: token ?? undefined,
        dry,
        debug,
        context,
        mode: 'cli',
        telemetry: false,
        // buffer = true will not stream output
        buffer: json || silent,
        offline,
        cwd,
        featureFlags: {
            ...edgeFunctionsFeatureFlags,
            ...getFeatureFlagsFromSiteInfo(cachedConfig.siteInfo),
            functionsBundlingManifest: true,
        },
        // @ts-expect-error(serhalp) -- TODO(serhalp): Upstream the type fixes above into @netlify/build
        eventHandlers,
        edgeFunctionsBootstrapURL: await getBootstrapURL(),
    };
};
export const runBuild = async (options) => {
    // If netlify NETLIFY_API_URL is set we need to pass this information to @netlify/build
    // TODO don't use testOpts, but add real properties to do this.
    if (process.env.NETLIFY_API_URL) {
        const apiUrl = new URL(process.env.NETLIFY_API_URL);
        const testOpts = {
            scheme: apiUrl.protocol.slice(0, -1),
            host: apiUrl.host,
        };
        // @ts-expect-error(serhalp) -- I don't know what's going on here and I can't convince myself it even works as
        // intended. TODO(serhalp): Investigate and fix types.
        options = { ...options, testOpts };
    }
    const { configMutations, netlifyConfig: newConfig, severityCode: exitCode,
    // TODO(serhalp): Upstream the type fixes above into @netlify/build and remove this type assertion
     } = await build(options);
    return { exitCode, newConfig, configMutations };
};
//# sourceMappingURL=build.js.map