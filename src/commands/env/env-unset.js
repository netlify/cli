// @ts-check
const { log, logJson } = require('../../utils')

/**
 * The env:unset command
 * @param {string} name Environment variable name
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns {Promise<boolean>}
 */
const envUnset = async (name, options, command) => {
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
  } = siteData

  const newEnv = env

  // Delete environment variable from current variables
  delete newEnv[name]

  // Apply environment variable updates
  const siteResult = await api.updateSite({
    siteId,
    body: {
      build_settings: {
        env: newEnv,
      },
    },
  })

  // Return new environment variables of site if using json flag
  if (options.json) {
    logJson(siteResult.build_settings.env)
    return false
  }

  log(`Unset environment variable ${name} for site ${siteData.name}`)
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
    .argument('<name>', 'Environment variable name')
    .description('Unset an environment variable which removes it from the UI')
    .action(async (name, options, command) => {
      await envUnset(name, options, command)
    })

module.exports = { createEnvUnsetCommand }
