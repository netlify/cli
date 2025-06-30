import process from 'process';
import getPort from 'get-port';
import isEmpty from 'lodash/isEmpty.js';
import { supportsBackgroundFunctions } from '../lib/account.js';
import { NETLIFYDEVLOG, chalk, logAndThrowError, log, warn } from './command-helpers.js';
import { loadDotEnvFiles } from './dot-env.js';
// Possible sources of environment variables. For the purpose of printing log messages only. Order does not matter.
const ENV_VAR_SOURCES = {
    account: {
        name: 'shared',
        printFn: chalk.magenta,
    },
    addons: {
        name: 'addon',
        printFn: chalk.yellow,
    },
    configFile: {
        name: 'netlify.toml file',
        printFn: chalk.green,
    },
    general: {
        name: 'general context',
        printFn: chalk.italic,
    },
    process: {
        name: 'process',
        printFn: chalk.red,
    },
    ui: {
        name: 'project settings',
        printFn: chalk.blue,
    },
};
const ERROR_CALL_TO_ACTION = "Double-check your login status with 'netlify status' or contact support with details of your error.";
// @ts-expect-error TS(7031) FIXME: Binding element 'site' implicitly has an 'any' typ... Remove this comment to see the full error message
const validateSiteInfo = ({ site, siteInfo }) => {
    if (isEmpty(siteInfo)) {
        return logAndThrowError(`Failed to retrieve project information for project ${chalk.yellow(site.id)}. ${ERROR_CALL_TO_ACTION}`);
    }
};
const getAccounts = async ({ api }) => {
    try {
        const accounts = await api.listAccountsForUser();
        return accounts;
    }
    catch (error_) {
        return logAndThrowError(`Failed retrieving user account: ${error_.message}. ${ERROR_CALL_TO_ACTION}`);
    }
};
// @ts-expect-error TS(7031) FIXME: Binding element 'api' implicitly has an 'any' type... Remove this comment to see the full error message
const getAddons = async ({ api, site }) => {
    try {
        const addons = await api.listServiceInstancesForSite({ siteId: site.id });
        return addons;
    }
    catch (error_) {
        return logAndThrowError(`Failed retrieving addons for site ${chalk.yellow(site.id)}: ${error_.message}. ${ERROR_CALL_TO_ACTION}`);
    }
};
// @ts-expect-error TS(7031) FIXME: Binding element 'addons' implicitly has an 'any' t... Remove this comment to see the full error message
const getAddonsInformation = ({ addons, siteInfo }) => {
    const urls = Object.fromEntries(
    // @ts-expect-error TS(7006) FIXME: Parameter 'addon' implicitly has an 'any' type.
    addons.map((addon) => [addon.service_slug, `${siteInfo.ssl_url}${addon.service_path}`]));
    // @ts-expect-error TS(7006) FIXME: Parameter 'addon' implicitly has an 'any' type.
    const env = Object.assign({}, ...addons.map((addon) => addon.env));
    return { urls, env };
};
const getSiteAccount = ({ accounts, siteInfo }) => {
    const siteAccount = accounts.find((account) => account.slug === siteInfo.account_slug);
    if (!siteAccount) {
        warn(`Could not find account for project '${siteInfo.name}' with account slug '${siteInfo.account_slug}'`);
        return undefined;
    }
    return siteAccount;
};
// default 10 seconds for synchronous functions
const SYNCHRONOUS_FUNCTION_TIMEOUT = 30;
// default 15 minutes for background functions
const BACKGROUND_FUNCTION_TIMEOUT = 900;
/**
 *
 * @param {object} config
 * @param {boolean} config.offline
 * @param {*} config.api
 * @param {*} config.site
 * @param {*} config.siteInfo
 * @returns
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'api' implicitly has an 'any' type... Remove this comment to see the full error message
export const getSiteInformation = async ({ api, offline, site, siteInfo }) => {
    if (site.id && !offline) {
        validateSiteInfo({ site, siteInfo });
        const [accounts, addons] = await Promise.all([getAccounts({ api }), getAddons({ api, site })]);
        const { urls: addonsUrls } = getAddonsInformation({ siteInfo, addons });
        const account = getSiteAccount({ siteInfo, accounts });
        return {
            addonsUrls,
            siteUrl: siteInfo.ssl_url,
            accountId: account?.id,
            capabilities: {
                backgroundFunctions: supportsBackgroundFunctions(account),
            },
            timeouts: {
                syncFunctions: siteInfo.functions_timeout ?? siteInfo.functions_config?.timeout ?? SYNCHRONOUS_FUNCTION_TIMEOUT,
                backgroundFunctions: BACKGROUND_FUNCTION_TIMEOUT,
            },
        };
    }
    // best defaults we can have without retrieving site information
    return {
        addonsUrls: {},
        siteUrl: '',
        capabilities: {},
        timeouts: {
            syncFunctions: SYNCHRONOUS_FUNCTION_TIMEOUT,
            backgroundFunctions: BACKGROUND_FUNCTION_TIMEOUT,
        },
    };
};
// @ts-expect-error TS(7006) FIXME: Parameter 'source' implicitly has an 'any' type.
const getEnvSourceName = (source) => {
    // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    const { name = source, printFn = chalk.green } = ENV_VAR_SOURCES[source] || {};
    return printFn(name);
};
/**
 * @param {{devConfig: any, env: Record<string, { sources: string[], value: string}>, site: any}} param0
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'devConfig' implicitly has an 'any... Remove this comment to see the full error message
export const getDotEnvVariables = async ({ devConfig, env, site }) => {
    const dotEnvFiles = await loadDotEnvFiles({ envFiles: devConfig.envFiles, projectDir: site.root });
    // @ts-expect-error TS(2339) FIXME: Property 'env' does not exist on type '{ warning: ... Remove this comment to see the full error message
    dotEnvFiles.forEach(({ env: fileEnv, file }) => {
        const newSourceName = `${file} file`;
        Object.keys(fileEnv).forEach((key) => {
            const sources = key in env ? [newSourceName, ...env[key].sources] : [newSourceName];
            if (sources.includes('internal')) {
                return;
            }
            env[key] = {
                sources,
                value: fileEnv[key],
            };
        });
    });
    return env;
};
/**
 * Takes a set of environment variables in the format provided by @netlify/config and injects them into `process.env`
 */
export const injectEnvVariables = (env) => {
    const envVarsToLogByUsedSource = {};
    for (const [key, variable] of Object.entries(env)) {
        const existsInProcess = process.env[key] !== undefined;
        const [usedSource, ...overriddenSources] = existsInProcess ? ['process', ...variable.sources] : variable.sources;
        const usedSourceName = getEnvSourceName(usedSource);
        const isInternal = variable.sources.includes('internal');
        overriddenSources.forEach((source) => {
            const sourceName = getEnvSourceName(source);
            log(chalk.dim(`${NETLIFYDEVLOG} Ignored ${chalk.bold(sourceName)} env var: ${chalk.yellow(key)} (defined in ${usedSourceName})`));
        });
        if (!existsInProcess || isInternal) {
            // Omitting `general` and `internal` env vars to reduce noise in the logs.
            if (usedSource !== 'general' && !isInternal) {
                envVarsToLogByUsedSource[usedSource] ??= [];
                envVarsToLogByUsedSource[usedSource].push(key);
            }
            process.env[key] = variable.value;
        }
    }
    for (const [source, keys] of Object.entries(envVarsToLogByUsedSource)) {
        const sourceName = getEnvSourceName(source);
        log(`${NETLIFYDEVLOG} Injected ${sourceName} env vars: ${keys.map((key) => chalk.yellow(key)).join(', ')}`);
    }
};
export const acquirePort = async ({ configuredPort, defaultPort, errorMessage, }) => {
    const acquiredPort = await getPort({ port: configuredPort || defaultPort });
    if (configuredPort && acquiredPort !== configuredPort) {
        throw new Error(`${errorMessage}: '${configuredPort}'`);
    }
    return acquiredPort;
};
// @ts-expect-error TS(7006) FIXME: Parameter 'fn' implicitly has an 'any' type.
export const processOnExit = (fn) => {
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT', 'SIGHUP', 'exit'];
    signals.forEach((signal) => {
        process.on(signal, fn);
    });
};
export const UNLINKED_SITE_MOCK_ID = 'unlinked';
//# sourceMappingURL=dev.js.map