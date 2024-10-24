import { OptionValues } from 'commander'

import { chalk, log, error as logError } from '../../utils/command-helpers.js'
import { isAPIEnvError } from '../../utils/env/index.js'
import type { ExtendedNetlifyAPI } from '../api-types.d.ts'
import BaseCommand from '../base-command.js'
import { CloneEnvParams } from './types.js'

const safeGetSite = async (api: ExtendedNetlifyAPI, siteId: string) => {
  try {
    const data = await api.getSite({ siteId })
    return { data }
  } catch (error) {
    return { error }
  }
}

/**
 * Copies the env from a site configured with Envelope to a different site configured with Envelope
 * @returns {Promise<boolean>}
 */
const cloneEnvVars = async ({ api, siteFrom, siteTo }: CloneEnvParams): Promise<boolean> => {
  const [envelopeFrom, envelopeTo] = await Promise.all([
    api.getEnvVars({ accountId: siteFrom.account_slug, siteId: siteFrom.id }),
    api.getEnvVars({ accountId: siteTo.account_slug, siteId: siteTo.id }),
  ])

  const keysFrom = envelopeFrom.map(({ key }) => key)

  if (keysFrom.length === 0) {
    log(`${chalk.green(siteFrom.name)} has no environment variables, nothing to clone`)
    return false
  }

  const accountId = siteTo.account_slug
  const siteId = siteTo.id
  const envVarsToDelete = envelopeTo.filter(({ key }) => keysFrom.includes(key))
  // delete marked env vars in parallel
  await Promise.all(envVarsToDelete.map(({ key }) => api.deleteEnvVar({ accountId, siteId, key })))

  // hit create endpoint
  try {
    await api.createEnvVars({ accountId, siteId, body: envelopeFrom })
  } catch (error: unknown) {
    if (isAPIEnvError(error)) throw error.json ? error.json.msg : error
  }

  return true
}

export const envClone = async (options: OptionValues, command: BaseCommand) => {
  const { api, site } = command.netlify

  if (!site.id && !options.from) {
    log(
      'Please include the source site Id as the `--from` option, or run `netlify link` to link this folder to a Netlify site',
    )
    return false
  }

  const siteId = {
    from: options.from || site.id,
    to: options.to,
  }

  const [{ data: siteFrom, error: errorFrom }, { data: siteTo, error: errorTo }] = await Promise.all([
    safeGetSite(api, siteId.from),
    safeGetSite(api, siteId.to),
  ])

  if (errorFrom) {
    logError(`Can't find site with id ${chalk.bold(siteId.from)}. Please make sure the site exists.`)
    return false
  }

  if (errorTo) {
    logError(`Can't find site with id ${chalk.bold(siteId.to)}. Please make sure the site exists.`)
    return false
  }

  if (siteFrom && siteTo) {
    const success = await cloneEnvVars({ api, siteFrom, siteTo })

    if (!success) {
      return false
    }

    log(`Successfully cloned environment variables from ${chalk.green(siteFrom.name)} to ${chalk.green(siteTo.name)}`)
  }

  return true
}
