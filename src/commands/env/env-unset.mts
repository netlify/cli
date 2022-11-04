// @ts-check
const {
  
  AVAILABLE_CONTEXTS,
  
  chalk,
  
  error,
  
  log,
  
  logJson,
  
  normalizeContext,
  
  translateFromEnvelopeToMongo,
} = require('../../utils/index.mjs')

/**
 * The env:unset command
 * @param {string} key Environment variable key
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns {Promise<boolean>}
 */

const envUnset = async (key: $TSFixMe, options: $TSFixMe, command: $TSFixMe) => {
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

  const contextType = AVAILABLE_CONTEXTS.includes(context || 'all') ? 'context' : 'branch'
  log(`Unset environment variable ${chalk.yellow(key)} in the ${chalk.magenta(context || 'all')} ${contextType}`)
}

/**
 * Deletes a given key from the env of a site record
 * @returns {Promise<object>}
 */
const unsetInMongo = async ({
  api,
  key,
  siteInfo

}: $TSFixMe) => {
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
const unsetInEnvelope = async ({
  api,
  context,
  key,
  siteInfo

}: $TSFixMe) => {
  const accountId = siteInfo.account_slug
  const siteId = siteInfo.id
  // fetch envelope env vars
  const envelopeVariables = await api.getEnvVars({ accountId, siteId })
  const contexts = context || ['all']

  const env = translateFromEnvelopeToMongo(envelopeVariables, context ? context[0] : 'dev')

  // check if the given key exists
  
  const variable = envelopeVariables.find((envVar: $TSFixMe) => envVar.key === key)
  if (!variable) {
    // if not, no need to call delete; return early
    return env
  }

  const params = { accountId, siteId, key }
  try {
    if (context) {
      // if context(s) are passed, delete the matching contexts / branches, and the `all` context
      
      const values = variable.values.filter((val: $TSFixMe) => [...contexts, 'all'].includes(val.context_parameter || val.context),
      )
      if (values) {
        
        await Promise.all(values.map((value: $TSFixMe) => api.deleteEnvVarValue({ ...params, id: value.id })))
        // if this was the `all` context, we need to create 3 values in the other contexts
        if (values.length === 1 && values[0].context === 'all') {
          
          const newContexts = AVAILABLE_CONTEXTS.filter((ctx: $TSFixMe) => !context.includes(ctx))
          const allValue = values[0].value
          await Promise.all(
            newContexts
              
              .filter((ctx: $TSFixMe) => ctx !== 'all')
              
              .map((ctx: $TSFixMe) => api.setEnvVarValue({ ...params, body: { context: ctx, value: allValue } })),
          )
        }
      }
    } else {
      // otherwise, if no context passed, delete the whole key
      await api.deleteEnvVar({ accountId, siteId, key })
    }
  } catch (error_) {
    
    throw (error_ as $TSFixMe).json ? (error_ as $TSFixMe).json.msg : error_;
  }

  delete env[key]

  return env
}

/**
 * Creates the `netlify env:unset` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */

const createEnvUnsetCommand = (program: $TSFixMe) => program
  .command('env:unset')
  .aliases(['env:delete', 'env:remove'])
  .argument('<key>', 'Environment variable key')
  .option(
    '-c, --context <context...>',
    'Specify a deploy context or branch (contexts: "production", "deploy-preview", "branch-deploy", "dev") (default: all contexts)',
    // spread over an array for variadic options
    
    (context: $TSFixMe, previous = []) => [...previous, normalizeContext(context)],
  )
  .addExamples([
    'netlify env:unset VAR_NAME # unset in all contexts',
    'netlify env:unset VAR_NAME --context production',
    'netlify env:unset VAR_NAME --context production deploy-preview',
  ])
  .description('Unset an environment variable which removes it from the UI')
  
  .action(async (key: $TSFixMe, options: $TSFixMe, command: $TSFixMe) => {
    await envUnset(key, options, command)
  })

module.exports = { createEnvUnsetCommand }
