// @ts-check
const { log, logJson, translateFromEnvelopeToMongo } = require('../../utils')

/**
 * The env:set command
 * @param {string} key Environment variable key
 * @param {string} value Value to set to
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns {Promise<boolean>}
 */
const envSet = async (key, value, options, command) => {
  const { api, site } = command.netlify
  const siteId = site.id

  if (!siteId) {
    log('No site id found, please run inside a site folder or `netlify link`')
    return false
  }

  const siteData = await api.getSite({ siteId })

  // Get current environment variables set in the UI
  const setInService = siteData.use_envelope ? setInEnvelope : setInMongo
  const finalEnv = await setInService({ api, siteData, key, value })

  // Return new environment variables of site if using json flag
  if (options.json) {
    logJson(finalEnv)
    return false
  }

  log(`Set environment variable ${key}=${value} for site ${siteData.name}`)
}

/**
 * Updates the env for a site record with a new key/value pair
 * @returns {Promise<object>}
 */
const setInMongo = async ({ api, key, siteData, value }) => {
  const { env = {} } = siteData.build_settings
  const newEnv = {
    ...env,
    [key]: value,
  }
  // Apply environment variable updates
  await api.updateSite({
    siteId: siteData.id,
    body: {
      build_settings: {
        env: newEnv,
      },
    },
  })
  return newEnv
}

/**
 * Updates the env for a site configured with Envelope with a new key/value pair
 * @returns {Promise<object>}
 */
const setInEnvelope = async ({ api, key, siteData, value }) => {
  const accountId = siteData.account_slug
  const siteId = siteData.id
  // fetch envelope env vars
  const envelopeVariables = await api.getEnvVars({ accountId, siteId })
  const scopes = ['builds', 'functions', 'runtime', 'post_processing']
  const values = [{ context: 'all', value }]
  // check if we need to create or update
  const exists = envelopeVariables.some((envVar) => envVar.key === key)
  const method = exists ? api.updateEnvVar : api.createEnvVars
  const body = exists ? { key, scopes, values } : [{ key, scopes, values }]

  try {
    await method({ accountId, siteId, key, body })
  } catch (error) {
    throw error.json ? error.json.msg : error
  }

  const env = translateFromEnvelopeToMongo(envelopeVariables)
  return {
    ...env,
    [key]: value,
  }
}

/**
 * Creates the `netlify env:set` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createEnvSetCommand = (program) =>
  program
    .command('env:set')
    .argument('<key>', 'Environment variable key')
    .argument('[value]', 'Value to set to', '')
    .description('Set value of environment variable')
    .action(async (key, value, options, command) => {
      await envSet(key, value, options, command)
    })

module.exports = { createEnvSetCommand }
