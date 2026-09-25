import { readFile } from 'fs/promises'

import type { NetlifyAPI } from '@netlify/api'
import AsciiTable from 'ascii-table'
import dotenv from 'dotenv'

import { exit, log, logJson } from '../../utils/command-helpers.js'
import { getEnvelopeItems, translateFromEnvelopeToMongo, translateFromMongoToEnvelope } from '../../utils/env/index.js'
import type { SiteInfo } from '../../utils/types.js'
import type BaseCommand from '../base-command.js'
import type { EnvImportOptionValues } from './option_values.js'
import { getSiteInfo } from './utils.js'

/**
 * Saves the imported env in the Envelope service
 */
const importDotEnv = async ({
  api,
  importedEnv,
  options,
  siteInfo,
}: {
  api: NetlifyAPI
  importedEnv: Record<string, string>
  options: EnvImportOptionValues
  siteInfo: SiteInfo
}): Promise<Record<string, string>> => {
  // fetch env vars
  const accountId = siteInfo.account_slug
  const siteId = siteInfo.id
  const dotEnvKeys = Object.keys(importedEnv)
  const envelopeVariables = await getEnvelopeItems({ api, accountId, siteId })
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
    // @ts-expect-error FIXME(@netlify/api): `createEnvVars` body `scopes` rejects `post_processing`, which Envelope returns and accepts
    await api.createEnvVars({ accountId, siteId, body })
  } catch (error) {
    // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
    throw error.json ? error.json.msg : error
  }

  // return final env to aid in --json output (for testing)
  return {
    ...translateFromEnvelopeToMongo(envelopeVariables.filter(({ key }) => !keysToDelete.includes(key))),
    ...importedEnv,
  }
}

export const envImport = async (fileName: string, options: EnvImportOptionValues, command: BaseCommand) => {
  const { api, cachedConfig, site } = command.netlify
  const siteId = site.id

  if (!siteId) {
    log('No project id found, please run inside a project folder or `netlify link`')
    return false
  }

  const siteInfo = await getSiteInfo(api, siteId, cachedConfig)

  let importedEnv: Record<string, string> = {}
  try {
    const envFileContents = await readFile(fileName, 'utf-8')
    importedEnv = dotenv.parse(envFileContents)
  } catch (error) {
    // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
    log(error.message)
    exit(1)
  }

  if (Object.keys(importedEnv).length === 0) {
    log(`No environment variables found in file ${fileName} to import`)
    return false
  }

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
  log(`Changes will require a redeploy to take effect on any deployed versions of your project.`)
  return undefined
}
