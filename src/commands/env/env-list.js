// @ts-check
const AsciiTable = require('ascii-table')
const isEmpty = require('lodash/isEmpty')

const { log, logJson } = require('../../utils')

/**
 * The env:list command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns {Promise<boolean>}
 */
const envList = async (options, command) => {
  const { api, cachedConfig, site } = command.netlify
  const siteId = site.id

  if (!siteId) {
    log('No site id found, please run inside a site folder or `netlify link`')
    return false
  }

  const siteData = await api.getSite({ siteId })
  const environment = Object.fromEntries(
    Object.entries(cachedConfig.env)
      // Omitting general variables to reduce noise.
      .filter(([, variable]) => variable.sources[0] !== 'general')
      .map(([key, variable]) => [key, variable.value]),
  )

  // Return json response for piping commands
  if (options.json) {
    logJson(environment)
    return false
  }

  if (isEmpty(environment)) {
    log(`No environment variables set for site ${siteData.name}`)
    return false
  }

  // List environment variables using a table
  log(`site: ${siteData.name}`)
  const table = new AsciiTable(`Environment variables`)

  table.setHeading('Key', 'Value')
  table.addRowMatrix(Object.entries(environment))
  log(table.toString())
}

/**
 * Creates the `netlify env:list` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createEnvListCommand = (program) =>
  program
    .command('env:list')
    .description('Lists resolved environment variables for site (includes netlify.toml)')
    .action(async (options, command) => {
      await envList(options, command)
    })

module.exports = { createEnvListCommand }
