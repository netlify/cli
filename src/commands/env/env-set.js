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
  const { api, site } = command.netlify
  const siteId = site.id

  if (!siteId) {
    log('No site id found, please run inside a site folder or `netlify link`')
    return false
  }

  const siteData = await api.getSite({ siteId })

  // Get current environment variables set in the UI
  const setInService = siteData.use_envelope ? setInEnvelope : setInMongo
  const finalEnv = await setInService({ api, siteData, key, value, context, scope })

  // Return new environment variables of site if using json flag
  if (options.json) {
    logJson(finalEnv)
    return false
  }

  const withScope = scope === 'all' ? '' : ` scoped to ${chalk.whiteBright(scope)}`
  log(
    `Set environment variable ${chalk.yellowBright(
      `${key}${value ? '=' : ''}${value}`,
    )}${withScope} in ${chalk.magentaBright(context)} context${context === 'all' ? 's' : ''}`,
  )
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
const setInEnvelope = async ({ api, context = 'all', key, scope = 'all', siteData, value }) => {
  const accountId = siteData.account_slug
  const siteId = siteData.id
  // fetch envelope env vars
  const envelopeVariables = await api.getEnvVars({ accountId, siteId })
  let scopes = scope === 'all' ? AVAILABLE_SCOPES : scope.split(',')
  let values = context.split(',').map((ctx) => ({ context: ctx, value }))
  // check if we need to create or update
  const existing = envelopeVariables.find((envVar) => envVar.key === key)
  if (existing) {
    const all = existing.values.find((val) => val.context === 'all')
    if (scope === 'all') {
      // eslint-disable-next-line prefer-destructuring
      scopes = existing.scopes
    }
    if (!value.trim()) {
      // eslint-disable-next-line prefer-destructuring
      values = existing.values
    } else if (context === 'all') {
      values = [
        { context, value: value || existing.values.find((val) => [context, 'all'].includes(val.context)).value },
      ]
    } else {
      values = all
        ? [
            ...AVAILABLE_CONTEXTS.filter((ctx) => ctx !== context).map((ctx) => ({ context: ctx, value: all.value })),
            ...values,
          ]
        : [...existing.values.filter((val) => val.context !== context), ...values]
    }
  }
  const method = existing ? api.updateEnvVar : api.createEnvVars
  const body = existing ? { key, scopes, values } : [{ key, scopes, values }]

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
