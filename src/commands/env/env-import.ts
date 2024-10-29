import { readFile } from 'fs/promises'

import AsciiTable from 'ascii-table'
import dotenv from 'dotenv'

import { exit, log, logJson } from '../../utils/command-helpers.js'
import { translateFromEnvelopeToMongo, translateFromMongoToEnvelope, isAPIEnvError } from '../../utils/env/index.js'
import BaseCommand from '../base-command.js'

import { EnvImportOptions, EnvOptions, ImportDotEnvParams } from './types.js'

/**
 * Saves the imported env in the Envelope service
 * @returns {Promise<object>}
 */
const importDotEnv = async ({ api, importedEnv, options, siteInfo }: ImportDotEnvParams) => {
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
  } catch (error: unknown) {
    if (isAPIEnvError(error)) {
      throw error.json ? error.json.msg : error
    }
  }

  // return final env to aid in --json output (for testing)
  return {
    ...translateFromEnvelopeToMongo(envelopeVariables.filter(({ key }) => !keysToDelete.includes(key))),
    ...importedEnv,
  }
}

export const envImport = async (fileName: string, options: EnvImportOptions, command: BaseCommand) => {
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
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
      log(error.message)
    }
    exit(1)
  }

  if (Object.keys(importedEnv).length === 0) {
    log(`No environment variables found in file ${fileName} to import`)
    return false
  }

  const { siteInfo } = cachedConfig

  const finalEnv = await importDotEnv({ api, importedEnv, options, siteInfo })

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
