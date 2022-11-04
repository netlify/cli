// @ts-expect-error TS(2307): Cannot find module '../command-helpers.cjs' or its... Remove this comment to see the full error message
import commandHelpersPkg from '../command-helpers.cjs'

const { error } = commandHelpersPkg

export const AVAILABLE_CONTEXTS = ['all', 'production', 'deploy-preview', 'branch-deploy', 'dev']
export const AVAILABLE_SCOPES = ['builds', 'functions', 'runtime', 'post_processing']

/**
 * @param {string|undefined} context - The deploy context or branch of the environment variable value
 * @returns {Array<string|undefined>} The normalized context or branch name
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
export const normalizeContext = (context: $TSFixMe) => {
  if (!context) {
    return context
  }
  const CONTEXT_SYNONYMS = {
    dp: 'deploy-preview',
    prod: 'production',
  }
  context = context.toLowerCase()
  if (context in CONTEXT_SYNONYMS) {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    context = CONTEXT_SYNONYMS[context]
  }
  const forbiddenContexts = AVAILABLE_CONTEXTS.map((ctx) => `branch:${ctx}`)
  if (forbiddenContexts.includes(context)) {
    error(`The context ${context} includes a reserved keyword and is not allowed`)
  }
  context = context.replace(/^branch:/, '')
  return context
}

/**
 * Finds a matching environment variable value from a given context
 * @param {Array<object>} values - An array of environment variable values from Envelope
 * @param {string} context - The deploy context or branch of the environment variable value
 * @returns {object<context: enum<dev,branch-deploy,deploy-preview,production,branch>, context_parameter: <string>, value: string>} The matching environment variable value object
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
export const findValueInValues = (values: $TSFixMe, context: $TSFixMe) =>
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  values.find((val: $TSFixMe) => {
    if (!AVAILABLE_CONTEXTS.includes(context)) {
      // the "context" option passed in is actually the name of a branch
      return val.context === 'all' || val.context_parameter === context
    }
    return [context, 'all'].includes(val.context)
  })

/**
 * Finds environment variables that match a given source
 * @param {object} env - The dictionary of environment variables
 * @param {enum<general,account,addons,ui,configFile>} source - The source of the environment variable
 * @returns {object} The dictionary of env vars that match the given source
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
export const filterEnvBySource = (env: $TSFixMe, source: $TSFixMe) => Object.fromEntries(Object.entries(env).filter(([, variable]) => (variable as $TSFixMe).sources[0] === source));

/**
 * Fetches data from Envelope
 * @param {string} accountId - The account id
 * @param {object} api - The api singleton object
 * @param {string} key - If present, fetch a single key (case-sensitive)
 * @param {string} siteId - The site id
 * @returns {Array<object>} An array of environment variables from the Envelope service
 */
const fetchEnvelopeItems = async function ({
  accountId,
  api,
  key,
  siteId
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) {
  if (accountId === undefined) {
    return {}
  }
  try {
    // if a single key is passed, fetch that single env var
    if (key) {
      const envelopeItem = await api.getEnvVar({ accountId, key, siteId })
      return [envelopeItem]
    }
    // otherwise, fetch the entire list of env vars
    const envelopeItems = await api.getEnvVars({ accountId, siteId })
    return envelopeItems
  } catch {
    // Collaborators aren't allowed to read shared env vars,
    // so return an empty array silently in that case
    return []
  }
}

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
export const formatEnvelopeData = ({
  context = 'dev',
  envelopeItems = [],
  scope = 'any',
  source
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) =>
  envelopeItems
    // filter by context
    .filter(({
    values
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  }: $TSFixMe) => Boolean(findValueInValues(values, context)))
    // filter by scope
    .filter(({
    scopes
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  }: $TSFixMe) => (scope === 'any' ? true : scopes.includes(scope)))
    // sort alphabetically, case insensitive
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    .sort((left: $TSFixMe, right: $TSFixMe) => (left.key.toLowerCase() < right.key.toLowerCase() ? -1 : 1))
    // format the data
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    .reduce((acc: $TSFixMe, cur: $TSFixMe) => {
      const { context: ctx, context_parameter: branch, value } = findValueInValues(cur.values, context)
      return {
        ...acc,
        [cur.key]: {
          context: ctx,
          branch,
          scopes: cur.scopes,
          sources: [source],
          value,
        },
      }
    }, {})

/**
 * Collects env vars from multiple sources and arranges them in the correct order of precedence
 * @param {object} api - The api singleton object
 * @param {string} context - The deploy context or branch of the environment variable
 * @param {object} env - The dictionary of environment variables
 * @param {string} key - If present, fetch a single key (case-sensitive)
 * @param {enum<any,builds,functions,runtime,post_processing>} scope - The scope of the environment variables
 * @param {object} siteInfo - The site object
 * @returns {object} An object of environment variables keys and their metadata
 */
export const getEnvelopeEnv = async ({
  api,
  context = 'dev',
  env,
  key = '',
  scope = 'any',
  siteInfo
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  const { account_slug: accountId, id: siteId } = siteInfo

  const [accountEnvelopeItems, siteEnvelopeItems] = await Promise.all([
    fetchEnvelopeItems({ api, accountId, key }),
    fetchEnvelopeItems({ api, accountId, key, siteId }),
  ])

  const accountEnv = formatEnvelopeData({ context, envelopeItems: accountEnvelopeItems, scope, source: 'account' })
  const siteEnv = formatEnvelopeData({ context, envelopeItems: siteEnvelopeItems, scope, source: 'ui' })
  const generalEnv = filterEnvBySource(env, 'general')
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
  }
}

/**
 * Returns a human-readable, comma-separated list of scopes
 * @param {Array<enum<builds,functions,runtime,post_processing>>} scopes - An array of scopes
 * @returns {string} A human-readable, comma-separated list of scopes
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
export const getHumanReadableScopes = (scopes: $TSFixMe) => {
  const HUMAN_SCOPES = ['Builds', 'Functions', 'Runtime', 'Post processing']
  const SCOPES_MAP = {
    builds: HUMAN_SCOPES[0],
    functions: HUMAN_SCOPES[1],
    runtime: HUMAN_SCOPES[2],
    post_processing: HUMAN_SCOPES[3],
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
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  return scopes.map((scope: $TSFixMe) => SCOPES_MAP[scope]).join(', ');
}

/**
 * Translates a Mongo env into an Envelope env
 * @param {object} env - The site's env as it exists in Mongo
 * @returns {Array<object>} The array of Envelope env vars
 */
export const translateFromMongoToEnvelope = (env = {}) => {
  const envVars = Object.entries(env).map(([key, value]) => ({
    key,
    scopes: AVAILABLE_SCOPES,
    values: [
      {
        context: 'all',
        value,
      },
    ],
  }))

  return envVars
}

/**
 * Translates an Envelope env into a Mongo env
 * @param {Array<object>} envVars - The array of Envelope env vars
 * @param {string} context - The deploy context or branch of the environment variable
 * @returns {object} The env object as compatible with Mongo
 */
export const translateFromEnvelopeToMongo = (envVars = [], context = 'dev') => envVars
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    .sort((left, right) => ((left as $TSFixMe).key.toLowerCase() < (right as $TSFixMe).key.toLowerCase() ? -1 : 1))
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    .reduce((acc, cur: $TSFixMe) => {
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    const envVar = cur.values.find((val: $TSFixMe) => [context, 'all'].includes(val.context_parameter || val.context))
      if (envVar && envVar.value) {
        return {
          ...acc,
          [cur.key]: envVar.value,
        }
      }
      return acc
    }, {})

export default {
  AVAILABLE_CONTEXTS,
  AVAILABLE_SCOPES,
  findValueInValues,
  filterEnvBySource,
  formatEnvelopeData,
  getEnvelopeEnv,
  getHumanReadableScopes,
  normalizeContext,
  translateFromEnvelopeToMongo,
  translateFromMongoToEnvelope,
}
