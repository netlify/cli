export declare const AVAILABLE_CONTEXTS: string[];
export declare const AVAILABLE_SCOPES: string[];
/**
 * @param {string|undefined} context - The deploy context or branch of the environment variable value
 * @returns {Array<string|undefined>} The normalized context or branch name
 */
export declare const normalizeContext: (context: any) => any;
/**
 * Finds a matching environment variable value from a given context
 * @param {Array<object>} values - An array of environment variable values from Envelope
 * @param {string} context - The deploy context or branch of the environment variable value
 * @returns {object<context: enum<dev,branch-deploy,deploy-preview,production,branch>, context_parameter: <string>, value: string>} The matching environment variable value object
 */
export declare const findValueInValues: (values: any, context: any) => any;
/**
 * Finds environment variables that match a given source
 * @param {object} env - The dictionary of environment variables
 * @param {enum<general,account,addons,ui,configFile>} source - The source of the environment variable
 * @returns {object} The dictionary of env vars that match the given source
 */
export declare const filterEnvBySource: (env: any, source: any) => {
    [k: string]: unknown;
};
/**
 * Filters and sorts data from Envelope by a given context and/or scope
 * @param {string} context - The deploy context or branch of the environment variable value
 * @param {Array<object>} envelopeItems - An array of environment variables from the Envelope service
 * @param {enum<any,builds,functions,runtime,post_processing>} scope - The scope of the environment variables
 * @param {enum<general,account,addons,ui,configFile>} source - The source of the environment variable
 * @returns {object} A dicionary in the following format:
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
export declare const formatEnvelopeData: ({ context, envelopeItems, scope, source }: {
    context?: string | undefined;
    envelopeItems?: never[] | undefined;
    scope?: string | undefined;
    source: any;
}) => {};
/**
 * Collects env vars from multiple sources and arranges them in the correct order of precedence
 * @param {object} api - The api singleton object
 * @param {string} context - The deploy context or branch of the environment variable
 * @param {object} env - The dictionary of environment variables
 * @param {string} key - If present, fetch a single key (case-sensitive)
 * @param {boolean} raw - Return a dictionary of raw key/value pairs for only the account and site sources
 * @param {enum<any,builds,functions,runtime,post_processing>} scope - The scope of the environment variables
 * @param {object} siteInfo - The site object
 * @returns {object} An object of environment variables keys and their metadata
 */
export declare const getEnvelopeEnv: ({ api, context, env, key, raw, scope, siteInfo }: {
    api: any;
    context?: string | undefined;
    env: any;
    key?: string | undefined;
    raw?: boolean | undefined;
    scope?: string | undefined;
    siteInfo: any;
}) => Promise<{}>;
/**
 * Returns a human-readable, comma-separated list of scopes
 * @param {Array<enum<builds,functions,runtime,post_processing>>} scopes - An array of scopes
 * @returns {string} A human-readable, comma-separated list of scopes
 */
export declare const getHumanReadableScopes: (scopes: any) => any;
/**
 * Translates a Mongo env into an Envelope env
 * @param {object} env - The site's env as it exists in Mongo
 * @returns {Array<object>} The array of Envelope env vars
 */
export declare const translateFromMongoToEnvelope: (env?: {}) => {
    key: string;
    scopes: string[];
    values: {
        context: string;
        value: unknown;
    }[];
}[];
/**
 * Translates an Envelope env into a Mongo env
 * @param {Array<object>} envVars - The array of Envelope env vars
 * @param {string} context - The deploy context or branch of the environment variable
 * @returns {object} The env object as compatible with Mongo
 */
export declare const translateFromEnvelopeToMongo: (envVars?: never[], context?: string) => {};
//# sourceMappingURL=index.d.ts.map