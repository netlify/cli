// @ts-check
const { readFile } = require('fs').promises

const AsciiTable = require('ascii-table')
const dotenv = require('dotenv')
const isEmpty = require('lodash/isEmpty')

const { exit, log, logJson } = require('../../utils')

/**
 * The env:import command
 * @param {string} fileName .env file to import
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns {Promise<boolean>}
 */
const envImport = async (fileName, options, command) => {
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

  let importedEnv = {}
  try {
    const envFileContents = await readFile(fileName, 'utf-8')
    importedEnv = dotenv.parse(envFileContents)
  } catch (error) {
    log(error.message)
    exit(1)
  }

  if (isEmpty(importedEnv)) {
    log(`No environment variables found in file ${fileName} to import`)
    return false
  }

  // Apply environment variable updates
  const siteResult = await api.updateSite({
    siteId,
    body: {
      build_settings: {
        // Only set imported variables if --replaceExisting or otherwise merge
        // imported ones with the current environment variables.
        env: options.replaceExisting ? importedEnv : { ...env, ...importedEnv },
      },
    },
  })

  // Return new environment variables of site if using json flag
  if (options.json) {
    logJson(siteResult.build_settings.env)
    return false
  }

  // List newly imported environment variables in a table
  log(`site: ${siteData.name}`)
  const table = new AsciiTable(`Imported environment variables`)

  table.setHeading('Key', 'Value')
  table.addRowMatrix(Object.entries(importedEnv))
  log(table.toString())
}

/**
 * Creates the `netlify env:import` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createEnvImportCommand = (program) =>
  program
    .command('env:import')
    .argument('<fileName>', '.env file to import')
    .option(
      '-r, --replaceExisting',
      'Replace all existing variables instead of merging them with the current ones',
      false,
    )
    .description('Import and set environment variables from .env file')
    .action(async (fileName, options, command) => {
      await envImport(fileName, options, command)
    })

module.exports = { createEnvImportCommand }
