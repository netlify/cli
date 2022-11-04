// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'Option'.
const { Option } = require('commander')

const {
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'AVAILABLE_... Remove this comment to see the full error message
  AVAILABLE_CONTEXTS,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'chalk'.
  chalk,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'error'.
  error,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getEnvelop... Remove this comment to see the full error message
  getEnvelopeEnv,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'log'.
  log,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'logJson'.
  logJson,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'normalizeC... Remove this comment to see the full error message
  normalizeContext,
} = require('../../utils/index.mjs')

/**
 * The env:get command
 * @param {string} name Environment variable name
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const envGet = async (name: $TSFixMe, options: $TSFixMe, command: $TSFixMe) => {
  const { context, scope } = options
  const { api, cachedConfig, site } = command.netlify
  const siteId = site.id

  if (!siteId) {
    log('No site id found, please run inside a site folder or `netlify link`')
    return false
  }

  const { siteInfo } = cachedConfig
  let { env } = cachedConfig

  if (siteInfo.use_envelope) {
    env = await getEnvelopeEnv({ api, context, env, key: name, scope, siteInfo })
  } else if (context !== 'dev' || scope !== 'any') {
    error(
      `To specify a context or scope, please run ${chalk.yellow(
        'netlify open:admin',
      )} to open the Netlify UI and opt in to the new environment variables experience from Site settings`,
    )
    return false
  }

  const { value } = env[name] || {}

  // Return json response for piping commands
  if (options.json) {
    // @ts-expect-error TS(2345): Argument of type '{ [x: number]: any; }' is not as... Remove this comment to see the full error message
    logJson(value ? { [name]: value } : {})
    return false
  }

  if (!value) {
    const contextType = AVAILABLE_CONTEXTS.includes(context) ? 'context' : 'branch'
    const withContext = `in the ${chalk.magenta(context)} ${contextType}`
    const withScope = scope === 'any' ? '' : ` and the ${chalk.magenta(scope)} scope`
    log(`No value set ${withContext}${withScope} for environment variable ${chalk.yellow(name)}`)
    return false
  }

  log(value)
}

/**
 * Creates the `netlify env:get` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createEnvG... Remove this comment to see the full error message
const createEnvGetCommand = (program: $TSFixMe) => program
    .command('env:get')
    .argument('<name>', 'Environment variable name')
    .option('-c, --context <context>', 'Specify a deploy context or branch (contexts: "production", "deploy-preview", "branch-deploy", "dev")', normalizeContext, 'dev')
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    .addOption((new Option('-s, --scope <scope>', 'Specify a scope') as $TSFixMe).choices(['builds', 'functions', 'post-processing', 'runtime', 'any'])
    .default('any'))
    .addExamples([
    'netlify env:get MY_VAR # get value for MY_VAR in dev context',
    'netlify env:get MY_VAR --context production',
    'netlify env:get MY_VAR --context branch:staging',
    'netlify env:get MY_VAR --scope functions',
])
    .description('Get resolved value of specified environment variable (includes netlify.toml)')
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    .action(async (name: $TSFixMe, options: $TSFixMe, command: $TSFixMe) => {
    await envGet(name, options, command);
});

module.exports = { createEnvGetCommand }
