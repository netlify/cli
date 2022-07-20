const findValueFromContext = (values, context) => values.find((val) => [context, 'all'].includes(val.context))

const getRawEnvelope = async function ({ accountId, api, siteId }) {
  if (accountId === undefined) {
    return {}
  }
  try {
    const envelopeItems = await api.getEnvVars({ accountId, siteId })
    return envelopeItems
  } catch {
    // Collaborators aren't allowed to read shared env vars,
    // so return an empty array in that case
    return []
  }
}

const getFilteredAndSortedEnvelope = function ({ context = 'dev', envelopeItems = [], scope = 'any' }) {
  return (
    envelopeItems
      // filter by context
      .filter(({ values }) => Boolean(findValueFromContext(values, context)))
      // filter by scope
      .filter(({ scopes }) => (scope === 'any' ? true : scopes.includes(scope)))
      // sort alphabetically, case insensitive
      .sort((left, right) => (left.key.toLowerCase() < right.key.toLowerCase() ? -1 : 1))
  )
}

/**
 *
 * Outputs in a format like
 * {
 *   FOO: 'bar',
 *   BAZ: 'bang',
 * }
 *
 **/
const getEnvelopeDictionary = function ({ context = 'dev', envelopeItems = [], scope = 'any' }) {
  return getFilteredAndSortedEnvelope({ context, envelopeItems, scope }).reduce((acc, cur) => {
    const { value } = findValueFromContext(cur.values, context)
    return {
      ...acc,
      [cur.key]: value,
    }
  }, {})
}

/**
 *
 * Outputs in a format like
 * {
 *   FOO: {
 *     context: 'dev',
 *     scopes: ['builds', 'functions'],
 *     value: 'bar',
 *   },
 *   BAZ: {
 *     context: 'dev',
 *     scopes: ['functions'],
 *     value: 'bang',
 *   },
 * }
 *
 **/
const getEnvelopeMetadata = function ({ context = 'dev', envelopeItems = [], scope = 'any' }) {
  return getFilteredAndSortedEnvelope({ context, envelopeItems, scope }).reduce((acc, cur) => {
    const { value } = findValueFromContext(cur.values, context)
    return {
      ...acc,
      [cur.key]: {
        context,
        scopes: cur.scopes,
        value,
      },
    }
  }, {})
}

const getScopes = (scopes) => {
  const AVAILABLE_SCOPES = {
    builds: 'Builds',
    functions: 'Functions',
    post_processing: 'Post processing',
    runtime: 'Runtime',
  }
  if (!scopes) {
    // if `scopes` is not available, the env var comes from netlify.toml
    // env vars specified in netlify.toml are present in the `builds` and `post_processing` scope
    return 'Builds, Post processing'
  }
  if (scopes.length === Object.keys(AVAILABLE_SCOPES).length) {
    // shorthand instead of listing every available scope
    return 'All'
  }
  return scopes.map((scope) => AVAILABLE_SCOPES[scope]).join(', ')
}

/**
 * Translates a Mongo env into an Envelope env
 * @param {object} env - The site's env as it exists in Mongo
 * @returns {Array<object>} The array of Envelope env vars
 */
const translateFromMongoToEnvelope = (env = {}) => {
  const envVars = Object.entries(env).map(([key, value]) => ({
    key,
    scopes: ['builds', 'functions', 'runtime', 'post_processing'],
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
 * @returns {object} The env object as compatible with Mongo
 */
const translateFromEnvelopeToMongo = (envVars = []) =>
  envVars
    .sort((left, right) => (left.key.toLowerCase() < right.key.toLowerCase() ? -1 : 1))
    .reduce((acc, cur) => {
      const envVar = cur.values.find((val) => ['dev', 'all'].includes(val.context))
      if (envVar && envVar.value) {
        return {
          ...acc,
          [cur.key]: envVar.value,
        }
      }
      return acc
    }, {})

module.exports = {
  getEnvelopeDictionary,
  getEnvelopeMetadata,
  getRawEnvelope,
  getScopes,
  translateFromEnvelopeToMongo,
  translateFromMongoToEnvelope,
}
