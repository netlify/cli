const { Option } = require('commander')

// @ts-check
const { chalk, error, log, logJson, translateFromEnvelopeToMongo } = require('../../utils')

const AVAILABLE_CONTEXTS = ['production', 'deploy-preview', 'branch-deploy', 'dev']

/**
 * The env:unset command
 * @param {string} key Environment variable key
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns {Promise<boolean>}
 */
const envUnset = async (key, options, command) => {
  const { context } = options
  const { api, cachedConfig, site } = command.netlify
  const siteId = site.id

  if (!siteId) {
    log('No site id found, please run inside a site folder or `netlify link`')
    return false
  }

  const { siteInfo } = cachedConfig

  let finalEnv
  if (siteInfo.use_envelope) {
    finalEnv = await unsetInEnvelope({ api, context, siteInfo, key })
  } else if (context) {
    error(
      `To specify a context, please run ${chalk.yellow(
        'netlify open:admin',
      )} to open the Netlify UI and opt in to the new environment variables experience from Site settings`,
    )
    return false
  } else {
    finalEnv = await unsetInMongo({ api, siteInfo, key })
  }

  // Return new environment variables of site if using json flag
  if (options.json) {
    logJson(finalEnv)
    return false
  }

  log(
    `Unset environment variable ${chalk.yellow(key)} in ${chalk.magenta(context || 'all')} context${
      context ? '' : 's'
    }`,
  )
}

/**
 * Deletes a given key from the env of a site record
 * @returns {Promise<object>}
 */
const unsetInMongo = async ({ api, key, siteInfo }) => {
  // Get current environment variables set in the UI
  const {
    build_settings: { env = {} },
  } = siteInfo

  const newEnv = env

  // Delete environment variable from current variables
  delete newEnv[key]

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
 * Deletes a given key from the env of a site configured with Envelope
 * @returns {Promise<object>}
 */
const unsetInEnvelope = async ({ api, context, key, siteInfo }) => {
  const accountId = siteInfo.account_slug
  const siteId = siteInfo.id
  // fetch envelope env vars
  const envelopeVariables = await api.getEnvVars({ accountId, siteId })
  const contexts = context || ['all']

  const env = translateFromEnvelopeToMongo(envelopeVariables, contexts[0])

  // check if the given key exists
  const variable = envelopeVariables.find((envVar) => envVar.key === key)
  if (!variable) {
    // if not, no need to call delete; return early
    return env
  }

  const params = { accountId, siteId, key }
  try {
    if (context && context.length === 0) {
      // if no context passed, delete the whole key
      await api.deleteEnvVar({ accountId, siteId, key })
    } else {
      // otherwise, if context(s) are passed, delete the matching contexts, and the `all` context
      const values = variable.values.filter((val) => [...contexts, 'all'].includes(val.context))
      if (values) {
        await Promise.all(values.map((value) => api.deleteEnvVarValue({ ...params, id: value.id })))
        // if this was the `all` context, we need to create 3 values in the other contexts
        if (values.length === 1 && values[0].context === 'all') {
          const newContexts = AVAILABLE_CONTEXTS.filter((ctx) => !context.includes(ctx))
          const allValue = values[0].value
          await Promise.all(
            newContexts.map((ctx) => api.setEnvVarValue({ ...params, body: { context: ctx, value: allValue } })),
          )
        }
      }
    }
  } catch (error_) {
    console.log(error_)
    throw error_.json ? error_.json.msg : error_
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
    .addOption(
      new Option('-c, --context <context...>', 'Specify a deploy context (default: all contexts)').choices([
        'production',
        'deploy-preview',
        'branch-deploy',
        'dev',
      ]),
    )
    .description('Unset an environment variable which removes it from the UI')
    .action(async (key, options, command) => {
      await envUnset(key, options, command)
    })

module.exports = { createEnvUnsetCommand }
