// @ts-check
const { log, logJson } = require('../../utils')

/**
 * The env:set command
 * @param {string} name Environment variable name
 * @param {string} value Value to set to
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns {Promise<boolean>}
 */
const envSet = async (name, value, options, command) => {
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

  const newEnv = {
    ...env,
    [name]: value,
  }

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

  log(`Set environment variable ${name}=${value} for site ${siteData.name}`)
}

/**
 * Creates the `netlify env:set` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createEnvSetCommand = (program) =>
  program
    .command('env:set')
    .argument('<name>', 'Environment variable name')
    .argument('[value]', 'Value to set to', '')
    .description('Set value of environment variable')
    .action(async (name, value, options, command) => {
      await envSet(name, value, options, command)
    })

module.exports = { createEnvSetCommand }
