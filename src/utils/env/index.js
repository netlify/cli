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
  translateFromMongoToEnvelope,
  translateFromEnvelopeToMongo,
}
