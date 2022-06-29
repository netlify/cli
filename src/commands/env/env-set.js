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
  const {
    build_settings: { env = {} },
    use_envelope: useEnvelope,
  } = siteData

  let totalEnv
  if (useEnvelope) {
    const accountId = siteData.account_slug
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
      throw error.json.msg
    }

    const mongoEnv = translateFromEnvelopeToMongo(envelopeVariables)
    totalEnv = {
      ...mongoEnv,
      [key]: value,
    }
  } else {
    const newEnv = {
      ...env,
      [key]: value,
    }
    // Apply environment variable updates
    await api.updateSite({
      siteId,
      body: {
        build_settings: {
          env: newEnv,
        },
      },
    })
    totalEnv = newEnv
  }

  // Return new environment variables of site if using json flag
  if (options.json) {
    logJson(totalEnv)
    return false
  }

  log(`Set environment variable ${key}=${value} for site ${siteData.name}`)
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
