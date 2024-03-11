import fs from 'fs';
import process from 'process';
import build from '@netlify/build';
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'toml... Remove this comment to see the full error message
import tomlify from 'tomlify-j0.4';
import { getFeatureFlagsFromSiteInfo } from '../utils/feature-flags.js';
import { getBootstrapURL } from './edge-functions/bootstrap.js';
import { featureFlags as edgeFunctionsFeatureFlags } from './edge-functions/consts.js';
/**
 * The buildConfig + a missing cachedConfig
 * @typedef BuildConfig
 * @type {Parameters<import('@netlify/build/src/core/main.js')>[0] & {cachedConfig: any}}
 */
// We have already resolved the configuration using `@netlify/config`
// This is stored as `netlify.cachedConfig` and can be passed to
// `@netlify/build --cachedConfig`.
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
export const getBuildOptions = ({ 
// @ts-expect-error TS(7031) FIXME: Binding element 'cachedConfig' implicitly has an '... Remove this comment to see the full error message
cachedConfig, 
// @ts-expect-error TS(7031) FIXME: Binding element 'currentDir' implicitly has an 'an... Remove this comment to see the full error message
currentDir, 
// @ts-expect-error TS(7031) FIXME: Binding element 'deployHandler' implicitly has an ... Remove this comment to see the full error message
deployHandler, 
// @ts-expect-error TS(7031) FIXME: Binding element 'context' implicitly has an 'any' ... Remove this comment to see the full error message
options: { context, cwd, debug, dry, json, offline, silent }, 
// @ts-expect-error TS(7031) FIXME: Binding element 'packagePath' implicitly has an 'a... Remove this comment to see the full error message
packagePath, 
// @ts-expect-error TS(7031) FIXME: Binding element 'token' implicitly has an 'any' ty... Remove this comment to see the full error message
token, }) => {
    const eventHandlers = {
        onEnd: {
            // @ts-expect-error TS(7031) FIXME: Binding element 'netlifyConfig' implicitly has an ... Remove this comment to see the full error message
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
        // @ts-expect-error TS(2339) FIXME: Property 'onPostBuild' does not exist on type '{ o... Remove this comment to see the full error message
        eventHandlers.onPostBuild = {
            handler: deployHandler,
            description: 'Deploy Site',
        };
    }
    return {
        cachedConfig,
        siteId: cachedConfig.siteInfo.id,
        packagePath,
        token,
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
        eventHandlers,
        edgeFunctionsBootstrapURL: getBootstrapURL(),
    };
};
/**
 * run the build command
 * @param {BuildConfig} options
 * @returns
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'options' implicitly has an 'any' type.
export const runBuild = async (options) => {
    // If netlify NETLIFY_API_URL is set we need to pass this information to @netlify/build
    // TODO don't use testOpts, but add real properties to do this.
    if (process.env.NETLIFY_API_URL) {
        const apiUrl = new URL(process.env.NETLIFY_API_URL);
        const testOpts = {
            scheme: apiUrl.protocol.slice(0, -1),
            host: apiUrl.host,
        };
        options = { ...options, testOpts };
    }
    const { configMutations, netlifyConfig: newConfig, severityCode: exitCode } = await build(options);
    return { exitCode, newConfig, configMutations };
};
