import type { NetlifyAPI } from '@netlify/api';
import type { SiteInfo, EnvironmentVariableSource } from '../../utils/types.js';
/**
 * Supported values for the user-provided env `context` option.
 * These all match possible `context` values returned by the Envelope API.
 * Note that a user may also specify a branch name with the special `branch:my-branch-name` format.
 */
export declare const SUPPORTED_CONTEXTS: readonly ["all", "production", "deploy-preview", "branch-deploy", "dev"];
/**
 * Supported values for the user-provided env `scope` option.
 * These exactly match possible `scope` values returned by the Envelope API.
 * Note that `any` is also supported.
 */
export declare const ALL_ENVELOPE_SCOPES: readonly ["builds", "functions", "runtime", "post_processing"];
type EnvelopeEnvVarScope = Exclude<NonNullable<Awaited<ReturnType<NetlifyAPI['getEnvVars']>>[number]['scopes']>[number], 'post-processing'> | 'post_processing';
type EnvelopeEnvVar = Awaited<ReturnType<NetlifyAPI['getEnvVars']>>[number] & {
    scopes: EnvelopeEnvVarScope[];
};
type EnvelopeEnvVarContext = NonNullable<NonNullable<EnvelopeEnvVar['values']>[number]['context']>;
export type EnvelopeEnvVarValue = {
    /**
     * The deploy context of the this env var value
     */
    context?: EnvelopeEnvVarContext;
    /**
     * For parameterized contexts (i.e. only `branch`), context parameter (i.e. the branch name)
     */
    context_parameter?: string | undefined;
    /**
     * The value of the environment variable for this context. Note that this appears to be an empty string
     * when the env var is not set for this context.
     */
    value?: string | undefined;
};
export type EnvelopeItem = {
    key: string;
    scopes: EnvelopeEnvVarScope[];
    values: EnvelopeEnvVarValue[];
};
type SupportedScope = EnvelopeEnvVarScope | 'post_processing' | 'any';
type ContextOrBranch = string;
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
export declare const normalizeContext: (context: string) => ContextOrBranch;
/**
 * Finds a matching environment variable value for a given context
 * @private
 */
export declare const getValueForContext: (
/**
 * An array of environment variable values from Envelope
 */
values: EnvelopeEnvVarValue[], 
/**
 * The deploy context or branch of the environment variable value
 */
contextOrBranch: ContextOrBranch) => EnvelopeEnvVarValue | undefined;
/**
 * Finds environment variables that match a given source
 * @param env - The dictionary of environment variables
 * @param source - The source of the environment variable
 * @returns The dictionary of env vars that match the given source
 */
export declare const filterEnvBySource: (env: object, source: EnvironmentVariableSource) => typeof env;
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
export declare const formatEnvelopeData: ({ context, envelopeItems, scope, source, }: {
    context?: ContextOrBranch;
    envelopeItems: EnvelopeItem[];
    scope?: SupportedScope;
    source: string;
}) => Record<string, {
    context: ContextOrBranch;
    branch: string | undefined;
    scopes: string[];
    sources: string[];
    value: string;
}>;
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
export declare const getEnvelopeEnv: ({ api, context, env, key, raw, scope, siteInfo, }: {
    api: NetlifyAPI;
    context?: ContextOrBranch | undefined;
    env: object;
    key?: string | undefined;
    raw?: boolean | undefined;
    scope?: SupportedScope | undefined;
    siteInfo: SiteInfo;
}) => Promise<{}>;
/**
 * Returns a human-readable, comma-separated list of scopes
 * @param scopes An array of scopes
 * @returns A human-readable, comma-separated list of scopes
 */
export declare const getHumanReadableScopes: (scopes?: EnvelopeEnvVarScope[]) => string;
/**
 * Translates a Mongo env into an Envelope env
 * @param env The site's env as it exists in Mongo
 * @returns The array of Envelope env vars
 */
export declare const translateFromMongoToEnvelope: (env?: Record<string, string>) => {
    key: string;
    scopes: readonly ["builds", "functions", "runtime", "post_processing"];
    values: {
        context: "all";
        value: string;
    }[];
}[];
/**
 * Translates an Envelope env into a Mongo env
 * @param envVars The array of Envelope env vars
 * @param context The deploy context or branch of the environment variable
 * @returns The env object as compatible with Mongo
 */
export declare const translateFromEnvelopeToMongo: (envVars?: {
    key: string;
    scopes: string[];
    values: {
        context: string;
        value: string;
        context_parameter?: string | undefined;
    }[];
}[], context?: string) => {};
export {};
//# sourceMappingURL=index.d.ts.map