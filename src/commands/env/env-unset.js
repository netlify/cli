// @ts-check
const { log, logJson, translateFromEnvelopeToMongo } = require('../../utils')

/**
 * The env:unset command
 * @param {string} key Environment variable key
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns {Promise<boolean>}
 */
const envUnset = async (key, options, command) => {
  const { api, site } = command.netlify
  const siteId = site.id

  if (!siteId) {
    log('No site id found, please run inside a site folder or `netlify link`')
    return false
  }

  const siteData = await api.getSite({ siteId })

  const unsetInService = siteData.use_envelope ? unsetInEnvelope : unsetInMongo
  const finalEnv = await unsetInService({ api, siteData, key })

  // Return new environment variables of site if using json flag
  if (options.json) {
    logJson(finalEnv)
    return false
  }

  log(`Unset environment variable ${key} for site ${siteData.name}`)
}

/**
 * Deletes a given key from the env of a site record
 * @returns {Promise<object>}
 */
const unsetInMongo = async ({ api, key, siteData }) => {
  // Get current environment variables set in the UI
  const {
    build_settings: { env = {} },
  } = siteData

  const newEnv = env

  // Delete environment variable from current variables
  delete newEnv[key]

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
 * Deletes a given key from the env of a site configured with Envelope
 * @returns {Promise<object>}
 */
const unsetInEnvelope = async ({ api, key, siteData }) => {
  const accountId = siteData.account_slug
  const siteId = siteData.id
  // fetch envelope env vars
  const envelopeVariables = await api.getEnvVars({ accountId, siteId })

  // check if the given key exists
  const env = translateFromEnvelopeToMongo(envelopeVariables)
  if (!env[key]) {
    // if not, no need to call delete; return early
    return env
  }

  // delete the given key
  try {
    await api.deleteEnvVar({ accountId, siteId, key })
  } catch (error) {
    throw error.json ? error.json.msg : error
  }

  delete env[key]

  return env
}

/**
 * Creates the `netlify env:unset` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createEnvUnsetCommand = (program) =>
  program
    .command('env:unset')
    .aliases(['env:delete', 'env:remove'])
    .argument('<key>', 'Environment variable key')
    .description('Unset an environment variable which removes it from the UI')
    .action(async (key, options, command) => {
      await envUnset(key, options, command)
    })

module.exports = { createEnvUnsetCommand }
