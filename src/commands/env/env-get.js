// @ts-check
const { Option } = require('commander')

const { log, logJson } = require('../../utils')
const { getEnvelopeEnv } = require('../../utils/env')

/**
 * The env:get command
 * @param {string} name Environment variable name
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
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
    env = await getEnvelopeEnv({ api, context, env, scope, siteInfo })
  } else if (context !== 'dev' || scope !== 'any') {
    log(
      'The --context and --scope flags are only available on sites that have upgraded to the new environment variable experience.',
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
    log(`Environment variable ${name} not set for site ${siteInfo.name}`)
    return false
  }

  log(value)
}

/**
 * Creates the `netlify env:get` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createEnvGetCommand = (program) =>
  program
    .command('env:get')
    .argument('<name>', 'Environment variable name')
    .addOption(
      new Option('-c, --context <context>', '[Beta] Specify a deploy context')
        .choices(['production', 'deploy-preview', 'branch-deploy', 'dev'])
        .default('dev'),
    )
    .addOption(
      new Option('-s, --scope <scope>', '[Beta] Specify a scope')
        .choices(['builds', 'functions', 'post_processing', 'runtime', 'any'])
        .default('any'),
    )
    .description('Get resolved value of specified environment variable (includes netlify.toml)')
    .action(async (name, options, command) => {
      await envGet(name, options, command)
    })

module.exports = { createEnvGetCommand }
