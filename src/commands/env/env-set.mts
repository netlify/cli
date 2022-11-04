// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'Option'.
const { Option } = require('commander')

const {
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'AVAILABLE_... Remove this comment to see the full error message
  AVAILABLE_CONTEXTS,
  AVAILABLE_SCOPES,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'chalk'.
  chalk,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'error'.
  error,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'log'.
  log,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'logJson'.
  logJson,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'normalizeC... Remove this comment to see the full error message
  normalizeContext,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'translateF... Remove this comment to see the full error message
  translateFromEnvelopeToMongo,
} = require('../../utils/index.mjs')

/**
 * The env:set command
 * @param {string} key Environment variable key
 * @param {string} value Value to set to
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns {Promise<boolean>}
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const envSet = async (key: $TSFixMe, value: $TSFixMe, options: $TSFixMe, command: $TSFixMe) => {
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
const setInMongo = async ({
  api,
  key,
  siteInfo,
  value
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
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
const setInEnvelope = async ({
  api,
  context,
  key,
  scope,
  siteInfo,
  value
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  const accountId = siteInfo.account_slug
  const siteId = siteInfo.id
  // fetch envelope env vars
  const envelopeVariables = await api.getEnvVars({ accountId, siteId })
  const contexts = context || ['all']
  const scopes = scope || AVAILABLE_SCOPES

  // if the passed context is unknown, it is actually a branch name
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  let values = contexts.map((ctx: $TSFixMe) => AVAILABLE_CONTEXTS.includes(ctx) ? { context: ctx, value } : { context: 'branch', context_parameter: ctx, value },
  )

  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  const existing = envelopeVariables.find((envVar: $TSFixMe) => envVar.key === key)

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
        // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
        await Promise.all(values.map((val: $TSFixMe) => api.setEnvVarValue({ ...params, body: val })))
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
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    throw (error_ as $TSFixMe).json ? (error_ as $TSFixMe).json.msg : error_;
  }

  const env = translateFromEnvelopeToMongo(envelopeVariables, context ? context[0] : 'dev')
  return {
    ...env,
    [key]: value || env[key],
  }
}

/**
 * Creates the `netlify env:set` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createEnvS... Remove this comment to see the full error message
const createEnvSetCommand = (program: $TSFixMe) => program
    .command('env:set')
    .argument('<key>', 'Environment variable key')
    .argument('[value]', 'Value to set to', '')
    .option('-c, --context <context...>', 'Specify a deploy context or branch (contexts: "production", "deploy-preview", "branch-deploy", "dev") (default: all contexts)', 
// spread over an array for variadic options
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
(context: $TSFixMe, previous = []) => [...previous, normalizeContext(context)])
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    .addOption((new Option('-s, --scope <scope...>', 'Specify a scope (default: all scopes)') as $TSFixMe).choices([
    'builds',
    'functions',
    'post-processing',
    'runtime',
]))
    .description('Set value of environment variable')
    .addExamples([
    'netlify env:set VAR_NAME value # set in all contexts and scopes',
    'netlify env:set VAR_NAME value --context production',
    'netlify env:set VAR_NAME value --context production deploy-preview',
    'netlify env:set VAR_NAME value --scope builds',
    'netlify env:set VAR_NAME value --scope builds functions',
])
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    .action(async (key: $TSFixMe, value: $TSFixMe, options: $TSFixMe, command: $TSFixMe) => {
    await envSet(key, value, options, command);
});

module.exports = { createEnvSetCommand }
