// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'readFile'.
const { readFile } = require('fs').promises

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'AsciiTable... Remove this comment to see the full error message
const AsciiTable = require('ascii-table')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'dotenv'.
const dotenv = require('dotenv')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'isEmpty'.
const isEmpty = require('lodash/isEmpty')

const {
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'exit'.
  exit,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'log'.
  log,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'logJson'.
  logJson,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'translateF... Remove this comment to see the full error message
  translateFromEnvelopeToMongo,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'translateF... Remove this comment to see the full error message
  translateFromMongoToEnvelope,
} = require('../../utils/index.mjs')

/**
 * The env:import command
 * @param {string} fileName .env file to import
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns {Promise<boolean>}
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const envImport = async (fileName: $TSFixMe, options: $TSFixMe, command: $TSFixMe) => {
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
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    log((error as $TSFixMe).message);
    exit(1)
  }

  if (isEmpty(importedEnv)) {
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
const importIntoMongo = async ({
  api,
  importedEnv,
  options,
  siteInfo
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
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
const importIntoEnvelope = async ({
  api,
  importedEnv,
  options,
  siteInfo
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  // fetch env vars
  const accountId = siteInfo.account_slug
  const siteId = siteInfo.id
  const dotEnvKeys = Object.keys(importedEnv)
  const envelopeVariables = await api.getEnvVars({ accountId, siteId })
  const envelopeKeys = envelopeVariables.map(({
    key
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  }: $TSFixMe) => key)

  // if user intends to replace all existing env vars
  // either replace; delete all existing env vars on the site
  // or, merge; delete only the existing env vars that would collide with new .env entries
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  const keysToDelete = options.replaceExisting ? envelopeKeys : envelopeKeys.filter((key: $TSFixMe) => dotEnvKeys.includes(key))

  // delete marked env vars in parallel
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  await Promise.all(keysToDelete.map((key: $TSFixMe) => api.deleteEnvVar({ accountId, siteId, key })))

  // hit create endpoint
  const body = translateFromMongoToEnvelope(importedEnv)
  try {
    await api.createEnvVars({ accountId, siteId, body })
  } catch (error) {
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    throw (error as $TSFixMe).json ? (error as $TSFixMe).json.msg : error;
  }

  // return final env to aid in --json output (for testing)
  return {
    ...translateFromEnvelopeToMongo(envelopeVariables.filter(({
      key
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    }: $TSFixMe) => !keysToDelete.includes(key))),
    ...importedEnv,
  };
}

/**
 * Creates the `netlify env:import` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createEnvI... Remove this comment to see the full error message
const createEnvImportCommand = (program: $TSFixMe) => program
  .command('env:import')
  .argument('<fileName>', '.env file to import')
  .option(
    '-r, --replaceExisting',
    'Replace all existing variables instead of merging them with the current ones',
    false,
  )
  .description('Import and set environment variables from .env file')
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  .action(async (fileName: $TSFixMe, options: $TSFixMe, command: $TSFixMe) => {
    await envImport(fileName, options, command)
  })

module.exports = { createEnvImportCommand }
