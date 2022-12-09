// @ts-check
import { Option } from 'commander'

import { chalk, error, log, logJson } from '../../utils/command-helpers.mjs'
import {
  AVAILABLE_CONTEXTS,
  AVAILABLE_SCOPES,
  normalizeContext,
  translateFromEnvelopeToMongo,
} from '../../utils/env/index.mjs'

/**
 * The env:set command
 * @param {string} key Environment variable key
 * @param {string} value Value to set to
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
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
  let finalEnv

  // Get current environment variables set in the UI
  if (siteInfo.use_envelope) {
    finalEnv = await setInEnvelope({ api, siteInfo, key, value, context, scope })
  } else if (context || scope) {
    error(
      `To specify a context or scope, please run ${chalk.yellow(
        'netlify open:admin',
      )} to open the Netlify UI and opt in to the new environment variables experience from Site settings`,
    )
    return false
  } else {
    finalEnv = await setInMongo({ api, siteInfo, key, value })
  }

  if (!finalEnv) {
    return false
  }

  // Return new environment variables of site if using json flag
  if (options.json) {
    logJson(finalEnv)
    return false
  }

  const withScope = scope ? ` scoped to ${chalk.white(scope)}` : ''
  const contextType = AVAILABLE_CONTEXTS.includes(context || 'all') ? 'context' : 'branch'
  log(
    `Set environment variable ${chalk.yellow(`${key}${value ? '=' : ''}${value}`)}${withScope} in the ${chalk.magenta(
      context || 'all',
    )} ${contextType}`,
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
const setInEnvelope = async ({ api, context, key, scope, siteInfo, value }) => {
  const accountId = siteInfo.account_slug
  const siteId = siteInfo.id
  // fetch envelope env vars
  const envelopeVariables = await api.getEnvVars({ accountId, siteId })
  const contexts = context || ['all']
  const scopes = scope || AVAILABLE_SCOPES

  // if the passed context is unknown, it is actually a branch name
  let values = contexts.map((ctx) =>
    AVAILABLE_CONTEXTS.includes(ctx) ? { context: ctx, value } : { context: 'branch', context_parameter: ctx, value },
  )

  const existing = envelopeVariables.find((envVar) => envVar.key === key)

  const params = { accountId, siteId, key }
  try {
    if (existing) {
      if (!value) {
        // eslint-disable-next-line prefer-destructuring
        values = existing.values
      }
      if (context && scope) {
        error(
          'Setting the context and scope at the same time on an existing env var is not allowed. Run the set command separately for each update.',
        )
        return false
      }
      if (context) {
        // update individual value(s)
        await Promise.all(values.map((val) => api.setEnvVarValue({ ...params, body: val })))
      } else {
        // otherwise update whole env var
        const body = { key, scopes, values }
        await api.updateEnvVar({ ...params, body })
      }
    } else {
      // create whole env var
      const body = [{ key, scopes, values }]
      await api.createEnvVars({ ...params, body })
    }
  } catch (error_) {
    throw error_.json ? error_.json.msg : error_
  }

  const env = translateFromEnvelopeToMongo(envelopeVariables, context ? context[0] : 'dev')
  return {
    ...env,
    [key]: value || env[key],
  }
}

/**
 * Creates the `netlify env:set` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createEnvSetCommand = (program) =>
  program
    .command('env:set')
    .argument('<key>', 'Environment variable key')
    .argument('[value]', 'Value to set to', '')
    .option(
      '-c, --context <context...>',
      'Specify a deploy context or branch (contexts: "production", "deploy-preview", "branch-deploy", "dev") (default: all contexts)',
      // spread over an array for variadic options
      (context, previous = []) => [...previous, normalizeContext(context)],
    )
    .addOption(
      new Option('-s, --scope <scope...>', 'Specify a scope (default: all scopes)').choices([
        'builds',
        'functions',
        'post-processing',
        'runtime',
      ]),
    )
    .description('Set value of environment variable')
    .addExamples([
      'netlify env:set VAR_NAME value # set in all contexts and scopes',
      'netlify env:set VAR_NAME value --context production',
      'netlify env:set VAR_NAME value --context production deploy-preview',
      'netlify env:set VAR_NAME value --scope builds',
      'netlify env:set VAR_NAME value --scope builds functions',
    ])
    .action(async (key, value, options, command) => {
      await envSet(key, value, options, command)
    })
