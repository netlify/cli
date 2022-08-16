// @ts-check
const { Option } = require('commander')

const { chalk, log, logJson, translateFromEnvelopeToMongo } = require('../../utils')

const AVAILABLE_CONTEXTS = ['production', 'deploy-preview', 'branch-deploy', 'dev']
const AVAILABLE_SCOPES = ['builds', 'functions', 'runtime', 'post_processing']

/**
 * The env:set command
 * @param {string} key Environment variable key
 * @param {string} value Value to set to
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns {Promise<boolean>}
 */
const envSet = async (key, value, options, command) => {
  const { context, scope } = options
  const { api, cachedConfig, site } = command.netlify
  const siteId = site.id

  if (!siteId) {
    log('No site id found, please run inside a site folder or `netlify link`')
    return false
  }

  const { siteInfo } = cachedConfig

  // Get current environment variables set in the UI
  const setInService = siteInfo.use_envelope ? setInEnvelope : setInMongo
  const finalEnv = await setInService({ api, siteInfo, key, value, context, scope })

  if (!finalEnv) {
    return false
  }

  // Return new environment variables of site if using json flag
  if (options.json) {
    logJson(finalEnv)
    return false
  }

  const withScope = scope === 'all' ? '' : ` scoped to ${chalk.white(scope)}`
  log(
    `Set environment variable ${chalk.yellow(`${key}${value ? '=' : ''}${value}`)}${withScope} in ${chalk.magenta(
      context,
    )} context${context === 'all' ? 's' : ''}`,
  )
}

/**
 * Updates the env for a site record with a new key/value pair
 * @returns {Promise<object>}
 */
const setInMongo = async ({ api, key, siteInfo, value }) => {
  const { env = {} } = siteInfo.build_settings
  const newEnv = {
    ...env,
    [key]: value,
  }
  // Apply environment variable updates
  await api.updateSite({
    siteId: siteInfo.id,
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
const setInEnvelope = async ({ api, context = 'all', key, scope = 'all', siteInfo, value }) => {
  const accountId = siteInfo.account_slug
  const siteId = siteInfo.id
  // fetch envelope env vars
  const envelopeVariables = await api.getEnvVars({ accountId, siteId })
  const scopes = scope === 'all' ? AVAILABLE_SCOPES : scope.split(',')
  let values = context.split(',').map((ctx) => ({ context: ctx, value }))

  const existing = envelopeVariables.find((envVar) => envVar.key === key)

  let method
  let body
  if (existing) {
    if (!value) {
      // eslint-disable-next-line prefer-destructuring
      values = existing.values
    }
    if (context !== 'all' && scope !== 'all') {
      console.error('Setting the context and scope at the same time on an existing env var is not allowed.')
      return false
    }
    if (context === 'all') {
      // update whole env var
      method = api.updateEnvVar
      body = { key, scopes, values }
    } else {
      // otherwise update individual value
      method = api.setEnvVarValue
      body = { context, value }
    }
  } else {
    // create whole env var
    method = api.createEnvVars
    body = [{ key, scopes, values }]
  }

  try {
    await method({ accountId, siteId, key, body })
  } catch (error) {
    console.log(error)
    throw error.json ? error.json.msg : error
  }

  const env = translateFromEnvelopeToMongo(envelopeVariables, context)
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
    .addOption(
      new Option('-c, --context <context>', 'Specify a deploy context')
        .choices(['production', 'deploy-preview', 'branch-deploy', 'dev', 'all'])
        .default('all'),
    )
    .addOption(
      new Option('-s, --scope <scope>', 'Specify a scope')
        .choices(['builds', 'functions', 'post_processing', 'runtime', 'all'])
        .default('all'),
    )
    .description('Set value of environment variable')
    .action(async (key, value, options, command) => {
      await envSet(key, value, options, command)
    })

module.exports = { createEnvSetCommand }
