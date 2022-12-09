// @ts-check
import { Option } from 'commander'

import { chalk, error, log, logJson } from '../../utils/command-helpers.mjs'
import { AVAILABLE_CONTEXTS, getEnvelopeEnv, normalizeContext } from '../../utils/env/index.mjs'

/**
 * The env:get command
 * @param {string} name Environment variable name
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
const envGet = async (name, options, command) => {
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
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createEnvGetCommand = (program) =>
  program
    .command('env:get')
    .argument('<name>', 'Environment variable name')
    .option(
      '-c, --context <context>',
      'Specify a deploy context or branch (contexts: "production", "deploy-preview", "branch-deploy", "dev")',
      normalizeContext,
      'dev',
    )
    .addOption(
      new Option('-s, --scope <scope>', 'Specify a scope')
        .choices(['builds', 'functions', 'post-processing', 'runtime', 'any'])
        .default('any'),
    )
    .addExamples([
      'netlify env:get MY_VAR # get value for MY_VAR in dev context',
      'netlify env:get MY_VAR --context production',
      'netlify env:get MY_VAR --context branch:staging',
      'netlify env:get MY_VAR --scope functions',
    ])
    .description('Get resolved value of specified environment variable (includes netlify.toml)')
    .action(async (name, options, command) => {
      await envGet(name, options, command)
    })
