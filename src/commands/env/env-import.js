// @ts-check
const { readFile } = require('fs').promises

const AsciiTable = require('ascii-table')
const dotenv = require('dotenv')
const isEmpty = require('lodash/isEmpty')

const { exit, log, logJson, translateFromMongoToEnvelope } = require('../../utils')

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

  const siteData = await api.getSite({ siteId })

  const importIntoService = siteData.use_envelope ? importIntoEnvelope : importIntoMongo
  const newEnv = await importIntoService({ api, importedEnv, options, siteData })

  // Return new environment variables of site if using json flag
  if (options.json) {
    logJson(newEnv)
    return false
  }

  // List newly imported environment variables in a table
  log(`site: ${siteData.name}`)
  const table = new AsciiTable(`Imported environment variables`)

  table.setHeading('Key', 'Value')
  table.addRowMatrix(Object.entries(newEnv))
  log(table.toString())
}

const importIntoMongo = async ({ api, importedEnv, options, siteData }) => {
  const { env } = siteData.build_settings
  const siteId = siteData.id

  // Apply environment variable updates
  await api.updateSite({
    siteId,
    body: {
      build_settings: {
        // Only set imported variables if --replaceExisting or otherwise merge
        // imported ones with the current environment variables.
        env: options.replaceExisting ? importedEnv : { ...env, ...importedEnv },
      },
    },
  })

  return importedEnv
}

const importIntoEnvelope = async ({ api, importedEnv, options, siteData }) => {
  // fetch env vars
  const accountId = siteData.account_slug
  const siteId = siteData.id
  const envelopeVariables = await api.getEnvVars({ accountId, siteId })
  const keys = envelopeVariables.map(({ key }) => key)

  // if user intends to replace all existing env vars
  if (options.replaceExisting) {
    // TODO: Until there's an exposed wipeSite endpoint,
    // hit each env var with a DELETE in parallel
    await Promise.all(keys.map((key) => api.deleteEnvVar({ accountId, siteId, key })))
  } else {
    // otherwise, merge; filter out env vars that already exist
    const dotEnvEntries = Object.entries(importedEnv)
    const filteredEntries = dotEnvEntries.filter(([key]) => !keys.includes(key))
    importedEnv = Object.fromEntries(filteredEntries)
  }

  // hit create endpoint
  const body = translateFromMongoToEnvelope(importedEnv)
  try {
    await api.createEnvVars({ accountId, siteId, body })
  } catch (error) {
    throw error.json.msg
  }

  return importedEnv
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
