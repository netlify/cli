import { logAndThrowError } from '../command-helpers.js';
/**
 * Supported values for the user-provided env `context` option.
 * These all match possible `context` values returned by the Envelope API.
 * Note that a user may also specify a branch name with the special `branch:my-branch-name` format.
 */
export const SUPPORTED_CONTEXTS = ['all', 'production', 'deploy-preview', 'branch-deploy', 'dev'];
/**
 * Additional aliases for the user-provided env `context` option.
 */
const SUPPORTED_CONTEXT_ALIASES = {
    dp: 'deploy-preview',
    prod: 'production',
};
/**
 * Supported values for the user-provided env `scope` option.
 * These exactly match possible `scope` values returned by the Envelope API.
 * Note that `any` is also supported.
 */
export const ALL_ENVELOPE_SCOPES = ['builds', 'functions', 'runtime', 'post_processing'];
/**
 * Normalizes a user-provided "context". Note that this may be the special `branch:my-branch-name` format.
 *
 * - If this is a supported alias of a context, it will be normalized to the canonical context.
 * - Valid canonical contexts are returned as is.
 * - If this starts with `branch:`, it will be normalized to the branch name.
 *
 * @param context A user-provided context, context alias, or a string in the `branch:my-branch-name` format.
 *
 * @returns The normalized context name or just the branch name
 */
export const normalizeContext = (context) => {
    if (!context) {
        return context;
    }
    context = context.toLowerCase();
    if (context in SUPPORTED_CONTEXT_ALIASES) {
        context = SUPPORTED_CONTEXT_ALIASES[context];
    }
    const forbiddenContexts = SUPPORTED_CONTEXTS.map((ctx) => `branch:${ctx}`);
    if (forbiddenContexts.includes(context)) {
        return logAndThrowError(`The context ${context} includes a reserved keyword and is not allowed`);
    }
    return context.replace(/^branch:/, '');
};
/**
 * Finds a matching environment variable value for a given context
 * @private
 */
export const getValueForContext = (
/**
 * An array of environment variable values from Envelope
 */
values, 
/**
 * The deploy context or branch of the environment variable value
 */
contextOrBranch) => {
    const isSupportedContext = SUPPORTED_CONTEXTS.includes(contextOrBranch);
    if (!isSupportedContext) {
        const valueMatchingAsBranch = values.find((val) => val.context_parameter === contextOrBranch);
        // This is a `branch` context, which is an override, so it takes precedence
        if (valueMatchingAsBranch != null) {
            return valueMatchingAsBranch;
        }
        const valueMatchingContext = values.find((val) => val.context === 'all' || val.context === 'branch-deploy');
        return valueMatchingContext ?? undefined;
    }
    const valueMatchingAsContext = values.find((val) => val.context === 'all' || val.context === contextOrBranch);
    return valueMatchingAsContext ?? undefined;
};
/**
 * Finds environment variables that match a given source
 * @param env - The dictionary of environment variables
 * @param source - The source of the environment variable
 * @returns The dictionary of env vars that match the given source
 */
export const filterEnvBySource = (env, source) => Object.fromEntries(Object.entries(env).filter(([, variable]) => variable.sources[0] === source));
const fetchEnvelopeItems = async function ({ accountId, api, key, siteId, }) {
    if (accountId === undefined) {
        return [];
    }
    try {
        // if a single key is passed, fetch that single env var
        if (key) {
            const envelopeItem = await api.getEnvVar({ accountId, key, siteId });
            // See FIXME(serhalp) above
            return [envelopeItem];
        }
        // otherwise, fetch the entire list of env vars
        const envelopeItems = await api.getEnvVars({ accountId, siteId });
        // See FIXME(serhalp) above
        return envelopeItems;
    }
    catch {
        // Collaborators aren't allowed to read shared env vars,
        // so return an empty array silently in that case
        return [];
    }
};
/**
 * Filters and sorts data from Envelope by a given context and/or scope
 * @param context - The deploy context or branch of the environment variable value
 * @param envelopeItems - An array of environment variables from the Envelope service
 * @param scope - The scope of the environment variables
 * @param source - The source of the environment variable
 * @returns A dicionary in the following format:
 * {
 *   FOO: {
 *     context: 'dev',
 *     scopes: ['builds', 'functions'],
 *     sources: ['ui'],
 *     value: 'bar',
 *   },
 *   BAZ: {
 *     context: 'branch',
 *     branch: 'staging',
 *     scopes: ['runtime'],
 *     sources: ['account'],
 *     value: 'bang',
 *   },
 * }
 */
export const formatEnvelopeData = ({ context = 'dev', envelopeItems = [], scope = 'any', source, }) => envelopeItems
    // filter by context
    .filter(({ values }) => Boolean(getValueForContext(values, context)))
    // filter by scope
    .filter(({ scopes }) => (scope === 'any' ? true : scopes.includes(scope)))
    // sort alphabetically, case insensitive
    .sort((left, right) => (left.key.toLowerCase() < right.key.toLowerCase() ? -1 : 1))
    // format the data
    .reduce((acc, cur) => {
    const val = getValueForContext(cur.values, context);
    if (val === undefined) {
        throw new TypeError(`failed to locate environment variable value for ${context} context`);
    }
    const { context: itemContext, context_parameter: branch, value } = val;
    return {
        ...acc,
        [cur.key]: {
            context: itemContext,
            branch,
            scopes: cur.scopes,
            sources: [source],
            value,
        },
    };
}, {});
/**
 * Collects env vars from multiple sources and arranges them in the correct order of precedence
 * @param opts.api The api singleton object
 * @param opts.context The deploy context or branch of the environment variable
 * @param opts.env The dictionary of environment variables
 * @param opts.key If present, fetch a single key (case-sensitive)
 * @param opts.raw Return a dictionary of raw key/value pairs for only the account and site sources
 * @param opts.scope The scope of the environment variables
 * @param opts.siteInfo The site object
 * @returns An object of environment variables keys and their metadata
 */
export const getEnvelopeEnv = async ({ api, context = 'dev', env, key = '', raw = false, scope = 'any', siteInfo, }) => {
    const { account_slug: accountId, id: siteId } = siteInfo;
    const [accountEnvelopeItems, siteEnvelopeItems] = await Promise.all([
        fetchEnvelopeItems({ api, accountId, key }),
        fetchEnvelopeItems({ api, accountId, key, siteId }),
    ]);
    const accountEnv = formatEnvelopeData({ context, envelopeItems: accountEnvelopeItems, scope, source: 'account' });
    const siteEnv = formatEnvelopeData({ context, envelopeItems: siteEnvelopeItems, scope, source: 'ui' });
    if (raw) {
        const entries = Object.entries({ ...accountEnv, ...siteEnv });
        return entries.reduce((obj, [envVarKey, metadata]) => ({
            ...obj,
            [envVarKey]: metadata.value,
        }), {});
    }
    const generalEnv = filterEnvBySource(env, 'general');
    const internalEnv = filterEnvBySource(env, 'internal');
    const addonsEnv = filterEnvBySource(env, 'addons');
    const configFileEnv = filterEnvBySource(env, 'configFile');
    // filter out configFile env vars if a non-configFile scope is passed
    const includeConfigEnvVars = /any|builds|post[-_]processing/.test(scope);
    // Sources of environment variables, in ascending order of precedence.
    return {
        ...generalEnv,
        ...accountEnv,
        ...(includeConfigEnvVars ? addonsEnv : {}),
        ...siteEnv,
        ...(includeConfigEnvVars ? configFileEnv : {}),
        ...internalEnv,
    };
};
/**
 * Returns a human-readable, comma-separated list of scopes
 * @param scopes An array of scopes
 * @returns A human-readable, comma-separated list of scopes
 */
export const getHumanReadableScopes = (scopes) => {
    const HUMAN_SCOPES = ['Builds', 'Functions', 'Runtime', 'Post processing'];
    const SCOPES_MAP = {
        builds: HUMAN_SCOPES[0],
        functions: HUMAN_SCOPES[1],
        runtime: HUMAN_SCOPES[2],
        post_processing: HUMAN_SCOPES[3],
        // TODO(serhalp) I believe this isn't needed, as `post-processing` is a user-provided
        // CLI option, not a scope returned by the Envelope API.
        'post-processing': HUMAN_SCOPES[3],
    };
    if (!scopes) {
        // if `scopes` is not available, the env var comes from netlify.toml
        // env vars specified in netlify.toml are present in the `builds` and `post_processing` scope
        return 'Builds, Post processing';
    }
    if (scopes.length === Object.keys(HUMAN_SCOPES).length) {
        // shorthand instead of listing every available scope
        return 'All';
    }
    return scopes.map((scope) => SCOPES_MAP[scope]).join(', ');
};
/**
 * Translates a Mongo env into an Envelope env
 * @param env The site's env as it exists in Mongo
 * @returns The array of Envelope env vars
 */
export const translateFromMongoToEnvelope = (env = {}) => {
    const envVars = Object.entries(env).map(([key, value]) => ({
        key,
        scopes: ALL_ENVELOPE_SCOPES,
        values: [
            {
                context: 'all',
                value,
            },
        ],
    }));
    return envVars;
};
/**
 * Translates an Envelope env into a Mongo env
 * @param envVars The array of Envelope env vars
 * @param context The deploy context or branch of the environment variable
 * @returns The env object as compatible with Mongo
 */
export const translateFromEnvelopeToMongo = (envVars = [], context = 'dev') => envVars
    .sort((a, b) => (a.key.toLowerCase() < b.key.toLowerCase() ? -1 : 1))
    .reduce((acc, cur) => {
    const envVar = cur.values.find((val) => [context, 'all'].includes((val.context_parameter ?? '') || val.context));
    if (envVar && envVar.value) {
        return {
            ...acc,
            [cur.key]: envVar.value,
        };
    }
    return acc;
}, {});
//# sourceMappingURL=index.js.map