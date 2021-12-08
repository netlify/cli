// @ts-check
const AsciiTable = require('ascii-table')
const inquirer = require('inquirer')
const isEmpty = require('lodash/isEmpty')

const { chalk, log, logJson } = require('../../utils')

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

  // Prompt which environment values to list
  const listOptions = ['Key Names Only', 'Key Names and Values']

  const { listEnv } = await inquirer.prompt([
    {
      type: 'list',
      name: 'listEnv',
      message: 'List Environment Variable:',
      choices: listOptions,
      default: listOptions[0],
      filter(val) {
        return val.toLowerCase()
      },
    },
  ])

  // List environment in a table
  log(`Listing ${listEnv} for site: ${chalk.greenBright(siteData.name)}`)

  const table = new AsciiTable(`Environment variables`)

  if (listEnv === 'key names and values') {
    table.setHeading('Key', 'Value')
    table.addRowMatrix(Object.entries(environment))
  } else {
    table.setHeading('Key')
    table.addRowMatrix(Object.keys(environment))
  }

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
