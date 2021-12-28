// @ts-check
const AsciiTable = require('ascii-table')
const { isCI } = require('ci-info')
const inquirer = require('inquirer')
const isEmpty = require('lodash/isEmpty')

const { chalk, log, logJson } = require('../../utils')

const [logUpdatePromise, ansiEscapesPromise] = [import('log-update'), import('ansi-escapes')]

const MASK_LENGTH = 50
const MASK = '*'.repeat(MASK_LENGTH)

const getTable = ({ environment, hideValues }) => {
  const table = new AsciiTable(`Environment variables`)
  table.setHeading('Key', 'Value')
  table.addRowMatrix(Object.entries(environment).map(([key, value]) => [key, hideValues ? MASK : value]))
  return table.toString()
}

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
    log(`No environment variables set for site ${chalk.greenBright(siteData.name)}`)
    return false
  }

  // List environment in a table
  log(`Listing environment variables for site: ${chalk.greenBright(siteData.name)}`)

  if (isCI) {
    log(getTable({ environment, hideValues: false }))
    return false
  }

  const { default: logUpdate } = await logUpdatePromise

  logUpdate(getTable({ environment, hideValues: true }))
  const { showValues } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'showValues',
      message: 'Show values?',
      default: false,
    },
  ])

  if (showValues) {
    const { default: ansiEscapes } = await ansiEscapesPromise
    // since inquirer adds a prompt, we need to account for it when printing the table again
    log(ansiEscapes.eraseLines(3))
    logUpdate(getTable({ environment, hideValues: false }))
    log(`${chalk.cyan('?')} Show values? ${chalk.cyan('Yes')}`)
  }
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
