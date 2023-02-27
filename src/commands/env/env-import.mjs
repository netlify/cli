// @ts-check
import { readFile } from 'fs/promises'

import AsciiTable from 'ascii-table'
import { Option } from 'commander'
import dotenv from 'dotenv'

import { exit, log, logJson } from '../../utils/command-helpers.mjs'
import { translateFromEnvelopeToMongo, translateFromMongoToEnvelope } from '../../utils/env/index.mjs'

/**
 * The env:import command
 * @param {string} fileName .env file to import
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 * @returns {Promise<boolean>}
 */
const envImport = async (fileName, options, command) => {
  const { api, cachedConfig, site } = command.netlify
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

  if (Object.keys(importedEnv).length === 0) {
    log(`No environment variables found in file ${fileName} to import`)
    return false
  }

  const { siteInfo } = cachedConfig

  const importIntoService = siteInfo.use_envelope ? importIntoEnvelope : importIntoMongo
  const finalEnv = await importIntoService({ api, importedEnv, options, siteInfo })

  // Return new environment variables of site if using json flag
  if (options.json) {
    logJson(finalEnv)
    return false
  }

  // List newly imported environment variables in a table
  log(`site: ${siteInfo.name}`)
  const table = new AsciiTable(`Imported environment variables`)

  table.setHeading('Key', 'Value')
  table.addRowMatrix(Object.entries(importedEnv))
  log(table.toString())
}

/**
 * Updates the imported env in the site record
 * @returns {Promise<object>}
 */
const importIntoMongo = async ({ api, importedEnv, options, siteInfo }) => {
  const { env = {} } = siteInfo.build_settings
  const siteId = siteInfo.id

  const finalEnv = options.replaceExisting ? importedEnv : { ...env, ...importedEnv }

  // Apply environment variable updates
  await api.updateSite({
    siteId,
    body: {
      build_settings: {
        // Only set imported variables if --replaceExisting or otherwise merge
        // imported ones with the current environment variables.
        env: finalEnv,
      },
    },
  })

  return finalEnv
}

/**
 * Saves the imported env in the Envelope service
 * @returns {Promise<object>}
 */
const importIntoEnvelope = async ({ api, importedEnv, options, siteInfo }) => {
  // fetch env vars
  const accountId = siteInfo.account_slug
  const siteId = siteInfo.id
  const dotEnvKeys = Object.keys(importedEnv)
  const envelopeVariables = await api.getEnvVars({ accountId, siteId })
  const envelopeKeys = envelopeVariables.map(({ key }) => key)

  // if user intends to replace all existing env vars
  // either replace; delete all existing env vars on the site
  // or, merge; delete only the existing env vars that would collide with new .env entries
  const keysToDelete = options.replaceExisting ? envelopeKeys : envelopeKeys.filter((key) => dotEnvKeys.includes(key))

  // delete marked env vars in parallel
  await Promise.all(keysToDelete.map((key) => api.deleteEnvVar({ accountId, siteId, key })))

  // hit create endpoint
  const body = translateFromMongoToEnvelope(importedEnv)
  try {
    await api.createEnvVars({ accountId, siteId, body })
  } catch (error) {
    throw error.json ? error.json.msg : error
  }

  // return final env to aid in --json output (for testing)
  return {
    ...translateFromEnvelopeToMongo(envelopeVariables.filter(({ key }) => !keysToDelete.includes(key))),
    ...importedEnv,
  }
}

/**
 * Creates the `netlify env:import` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createEnvImportCommand = (program) =>
  program
    .command('env:import')
    .argument('<fileName>', '.env file to import')
    .addOption(
      new Option(
        '-r --replaceExisting',
        'Old, prefer --replace-existing. Replace all existing variables instead of merging them with the current ones',
      )
        .default(false)
        .hideHelp(true),
    )
    .option(
      '-r, --replace-existing',
      'Replace all existing variables instead of merging them with the current ones',
      false,
    )
    .description('Import and set environment variables from .env file')
    .action(async (fileName, options, command) => {
      await envImport(fileName, options, command)
    })
