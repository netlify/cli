import type { NetlifyAPI } from '@netlify/api'

import { logAndThrowError } from '../command-helpers.js'
import type { SiteInfo, EnvironmentVariableSource } from '../../utils/types.js'

/**
 * Supported values for the user-provided env `context` option.
 * These all match possible `context` values returned by the Envelope API.
 * Note that a user may also specify a branch name with the special `branch:my-branch-name` format.
 */
export const SUPPORTED_CONTEXTS = ['all', 'production', 'deploy-preview', 'branch-deploy', 'dev', 'dev-server'] as const
/**
 * Additional aliases for the user-provided env `context` option.
 */
const SUPPORTED_CONTEXT_ALIASES = {
  dp: 'deploy-preview',
  prod: 'production',
}
/**
 * Supported values for the user-provided env `scope` option.
 * These exactly match possible `scope` values returned by the Envelope API.
 * Note that `any` is also supported.
 */
export const ALL_ENVELOPE_SCOPES = ['builds', 'functions', 'runtime', 'post_processing'] as const

// TODO(serhalp) Netlify API is incorrect - the returned scope is `post_processing`, not `post-processing`
type EnvelopeEnvVarScope =
  | Exclude<NonNullable<Awaited<ReturnType<NetlifyAPI['getEnvVars']>>[number]['scopes']>[number], 'post-processing'>
  | 'post_processing'
type EnvelopeEnvVar = Awaited<ReturnType<NetlifyAPI['getEnvVars']>>[number] & {
  scopes: EnvelopeEnvVarScope[]
}

type EnvelopeEnvVarContext = NonNullable<
  | NonNullable<EnvelopeEnvVar['values']>[number]['context']
  // TODO(ndhoule): Netlify API is incorrect - Update OpenAPI types with this context type   ..
  | 'dev-server'
>

export type EnvelopeEnvVarValue = {
  /**
   * The deploy context of the this env var value
   */
  context?: EnvelopeEnvVarContext
  /**
   * For parameterized contexts (i.e. only `branch`), context parameter (i.e. the branch name)
   */
  context_parameter?: string | undefined
  /**
   * The value of the environment variable for this context. Note that this appears to be an empty string
   * when the env var is not set for this context.
   */
  value?: string | undefined
}

export type EnvelopeItem = {
  // FIXME(serhalp) Netlify API types claim this is optional. Investigate and fix here or there.
  key: string
  scopes: EnvelopeEnvVarScope[]
  values: EnvelopeEnvVarValue[]
}

// AFAICT, Envelope uses only `post_processing` on returned env vars; the CLI documents and expects
// only `post-processing` as a valid user-provided scope; the code handles both everywhere. Consider
// explicitly normalizing and dropping undocumented support for user-provided `post_processing`.
type SupportedScope = EnvelopeEnvVarScope | 'post_processing' | 'any'

type ContextOrBranch = string

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
export const normalizeContext = (context: string): ContextOrBranch => {
  if (!context) {
    return context
  }

  context = context.toLowerCase()
  if (context in SUPPORTED_CONTEXT_ALIASES) {
    context = SUPPORTED_CONTEXT_ALIASES[context as keyof typeof SUPPORTED_CONTEXT_ALIASES]
  }
  const forbiddenContexts = SUPPORTED_CONTEXTS.map((ctx) => `branch:${ctx}`)
  if (forbiddenContexts.includes(context)) {
    return logAndThrowError(`The context ${context} includes a reserved keyword and is not allowed`)
  }
  return context.replace(/^branch:/, '')
}

/**
 * Finds a matching environment variable value for a given context
 * @private
 */
export const getValueForContext = (
  /**
   * An array of environment variable values from Envelope
   */
  values: EnvelopeEnvVarValue[],
  /**
   * The deploy context or branch of the environment variable value
   */
  contextOrBranch: ContextOrBranch,
): EnvelopeEnvVarValue | undefined => {
  const isSupportedContext = (SUPPORTED_CONTEXTS as readonly string[]).includes(contextOrBranch)
  if (!isSupportedContext) {
    // FIXME(ndhoule): If it's not a supported context, we just assume this is a branch deploy. This
    // means that if you ever add a deploy context but forget to add it to SUPPORTED_CONTEXTS, we'll
    // just load the wrong environment variables. (This bug is not theoretical: it's why I'm writing
    // this comment.) We should instead pass a `context` and optional `branch` parameter to this
    // function rather than mix the two concepts, and we should fail when an unsupported context is
    // provided.
    const valueMatchingAsBranch = values.find((val) => val.context_parameter === contextOrBranch)
    // This is a `branch` context, which is an override, so it takes precedence
    if (valueMatchingAsBranch != null) {
      return valueMatchingAsBranch
    }
    const valueMatchingContext = values.find((val) => val.context === 'all' || val.context === 'branch-deploy')
    return valueMatchingContext ?? undefined
  }
  const valueMatchingAsContext = values.find((val) => val.context === 'all' || val.context === contextOrBranch)
  return valueMatchingAsContext ?? undefined
}

/**
 * Finds environment variables that match a given source
 * @param env - The dictionary of environment variables
 * @param source - The source of the environment variable
 * @returns The dictionary of env vars that match the given source
 */
export const filterEnvBySource = (env: object, source: EnvironmentVariableSource): typeof env =>
  Object.fromEntries(Object.entries(env).filter(([, variable]) => variable.sources[0] === source))

const fetchEnvelopeItems = async function ({
  accountId,
  api,
  key,
  siteId,
}: {
  accountId: string
  api: NetlifyAPI
  key: string
  siteId?: string | undefined
}): Promise<EnvelopeItem[]> {
  if (accountId === undefined) {
    return []
  }
  try {
    // if a single key is passed, fetch that single env var
    if (key) {
      const envelopeItem = await api.getEnvVar({ accountId, key, siteId })
      // See FIXME(serhalp) above
      return [envelopeItem as EnvelopeItem]
    }
    // otherwise, fetch the entire list of env vars
    const envelopeItems = await api.getEnvVars({ accountId, siteId })
    // See FIXME(serhalp) above
    return envelopeItems as EnvelopeItem[]
  } catch {
    // Collaborators aren't allowed to read shared env vars,
    // so return an empty array silently in that case
    return []
  }
}

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
export const formatEnvelopeData = ({
  context = 'dev',
  envelopeItems = [],
  scope = 'any',
  source,
}: {
  context?: ContextOrBranch
  envelopeItems: EnvelopeItem[]
  scope?: SupportedScope
  source: string
}): Record<
  string,
  {
    context: ContextOrBranch
    branch: string | undefined
    scopes: string[]
    sources: string[]
    value: string
  }
> =>
  envelopeItems
    // filter by context
    .filter(({ values }) => Boolean(getValueForContext(values, context)))
    // filter by scope
    .filter(({ scopes }) => (scope === 'any' ? true : scopes.includes(scope)))
    // sort alphabetically, case insensitive
    .sort((left, right) => (left.key.toLowerCase() < right.key.toLowerCase() ? -1 : 1))
    // format the data
    .reduce((acc, cur) => {
      const val = getValueForContext(cur.values, context)
      if (val === undefined) {
        throw new TypeError(`failed to locate environment variable value for ${context} context`)
      }
      const { context: itemContext, context_parameter: branch, value } = val
      return {
        ...acc,
        [cur.key]: {
          context: itemContext,
          branch,
          scopes: cur.scopes,
          sources: [source],
          value,
        },
      }
    }, {})

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
export const getEnvelopeEnv = async ({
  api,
  context = 'dev',
  env,
  key = '',
  raw = false,
  scope = 'any',
  siteInfo,
}: {
  api: NetlifyAPI
  context?: ContextOrBranch | undefined
  env: object
  key?: string | undefined
  raw?: boolean | undefined
  scope?: SupportedScope | undefined
  siteInfo: SiteInfo
}) => {
  const { account_slug: accountId, id: siteId } = siteInfo

  const [accountEnvelopeItems, siteEnvelopeItems] = await Promise.all([
    fetchEnvelopeItems({ api, accountId, key }),
    fetchEnvelopeItems({ api, accountId, key, siteId }),
  ])

  const accountEnv = formatEnvelopeData({ context, envelopeItems: accountEnvelopeItems, scope, source: 'account' })
  const siteEnv = formatEnvelopeData({ context, envelopeItems: siteEnvelopeItems, scope, source: 'ui' })

  if (raw) {
    const entries = Object.entries({ ...accountEnv, ...siteEnv })
    return entries.reduce(
      (obj, [envVarKey, metadata]) => ({
        ...obj,
        [envVarKey]: metadata.value,
      }),
      {},
    )
  }

  const generalEnv = filterEnvBySource(env, 'general')
  const internalEnv = filterEnvBySource(env, 'internal')
  const addonsEnv = filterEnvBySource(env, 'addons')
  const configFileEnv = filterEnvBySource(env, 'configFile')

  // filter out configFile env vars if a non-configFile scope is passed
  const includeConfigEnvVars = /any|builds|post[-_]processing/.test(scope)

  // Sources of environment variables, in ascending order of precedence.
  return {
    ...generalEnv,
    ...accountEnv,
    ...(includeConfigEnvVars ? addonsEnv : {}),
    ...siteEnv,
    ...(includeConfigEnvVars ? configFileEnv : {}),
    ...internalEnv,
  }
}

/**
 * Returns a human-readable, comma-separated list of scopes
 * @param scopes An array of scopes
 * @returns A human-readable, comma-separated list of scopes
 */
export const getHumanReadableScopes = (scopes?: EnvelopeEnvVarScope[]): string => {
  const HUMAN_SCOPES = ['Builds', 'Functions', 'Runtime', 'Post processing']
  const SCOPES_MAP = {
    builds: HUMAN_SCOPES[0],
    functions: HUMAN_SCOPES[1],
    runtime: HUMAN_SCOPES[2],
    post_processing: HUMAN_SCOPES[3],
    // TODO(serhalp) I believe this isn't needed, as `post-processing` is a user-provided
    // CLI option, not a scope returned by the Envelope API.
    'post-processing': HUMAN_SCOPES[3],
  }
  if (!scopes) {
    // if `scopes` is not available, the env var comes from netlify.toml
    // env vars specified in netlify.toml are present in the `builds` and `post_processing` scope
    return 'Builds, Post processing'
  }
  if (scopes.length === Object.keys(HUMAN_SCOPES).length) {
    // shorthand instead of listing every available scope
    return 'All'
  }
  return scopes.map((scope) => SCOPES_MAP[scope]).join(', ')
}

/**
 * Translates a Mongo env into an Envelope env
 * @param env The site's env as it exists in Mongo
 * @returns The array of Envelope env vars
 */
export const translateFromMongoToEnvelope = (env: Record<string, string> = {}) => {
  const envVars = Object.entries(env).map(([key, value]) => ({
    key,
    scopes: ALL_ENVELOPE_SCOPES,
    values: [
      {
        context: 'all' as const,
        value,
      },
    ],
  }))

  return envVars
}

/**
 * Translates an Envelope env into a Mongo env
 * @param envVars The array of Envelope env vars
 * @param context The deploy context or branch of the environment variable
 * @returns The env object as compatible with Mongo
 */
export const translateFromEnvelopeToMongo = (
  envVars: {
    key: string
    scopes: string[]
    values: { context: string; value: string; context_parameter?: string | undefined }[]
  }[] = [],
  context = 'dev',
) =>
  envVars
    .sort((a, b) => (a.key.toLowerCase() < b.key.toLowerCase() ? -1 : 1))
    .reduce((acc, cur) => {
      const envVar = cur.values.find((val) => [context, 'all'].includes((val.context_parameter ?? '') || val.context))
      if (envVar && envVar.value) {
        return {
          ...acc,
          [cur.key]: envVar.value,
        }
      }
      return acc
    }, {})
