// @ts-check
const { log, logJson } = require('../../utils')

/**
 * The env:get command
 * @param {string} name Environment variable name
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const envGet = async (name, options, command) => {
  const { api, cachedConfig, site } = command.netlify
  const siteId = site.id

  if (!siteId) {
    log('No site id found, please run inside a site folder or `netlify link`')
    return false
  }

  const siteData = await api.getSite({ siteId })

  const { value } = cachedConfig.env[name] || {}

  // Return json response for piping commands
  if (options.json) {
    logJson(value ? { [name]: value } : {})
    return false
  }

  if (!value) {
    log(`Environment variable ${name} not set for site ${siteData.name}`)
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
    .description('Get resolved value of specified environment variable (includes netlify.toml)')
    .action(async (name, options, command) => {
      await envGet(name, options, command)
    })

module.exports = { createEnvGetCommand }
