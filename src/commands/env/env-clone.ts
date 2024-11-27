import { OptionValues } from 'commander'

import { chalk, log, error as logError } from '../../utils/command-helpers.js'
import { promptEnvCloneOverwrite } from '../../utils/prompts/env-clone-prompt.js'
import BaseCommand from '../base-command.js'

// @ts-expect-error TS(7006) FIXME: Parameter 'api' implicitly has an 'any' type.
const safeGetSite = async (api, siteId) => {
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
// @ts-expect-error TS(7031) FIXME: Binding element 'api' implicitly has an 'any' type... Remove this comment to see the full error message
const cloneEnvVars = async ({ api, force, siteFrom, siteTo }): Promise<boolean> => {
  const [envelopeFrom, envelopeTo] = await Promise.all([
    api.getEnvVars({ accountId: siteFrom.account_slug, siteId: siteFrom.id }),
    api.getEnvVars({ accountId: siteTo.account_slug, siteId: siteTo.id }),
  ])

  // @ts-expect-error TS(7031) FIXME: Binding element 'key' implicitly has an 'any' type... Remove this comment to see the full error message
  const keysFrom = envelopeFrom.map(({ key }) => key)

  if (keysFrom.length === 0) {
    log(`${chalk.green(siteFrom.name)} has no environment variables, nothing to clone`)
    return false
  }

  const accountId = siteTo.account_slug
  const siteId = siteTo.id
  // @ts-expect-error TS(7031) FIXME: Binding element 'key' implicitly has an 'any' type... Remove this comment to see the full error message
  const envVarsToDelete = envelopeTo.filter(({ key }) => keysFrom.includes(key))

  if (envVarsToDelete.length !== 0 && Boolean(force) === false) {
    await promptEnvCloneOverwrite(siteTo.id, envVarsToDelete)
  }
  // delete marked env vars in parallel
  // @ts-expect-error TS(7031) FIXME: Binding element 'key' implicitly has an 'any' type... Remove this comment to see the full error message
  await Promise.all(envVarsToDelete.map(({ key }) => api.deleteEnvVar({ accountId, siteId, key })))

  // hit create endpoint
  try {
    await api.createEnvVars({ accountId, siteId, body: envelopeFrom })
  } catch (error) {
    // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
    throw error.json ? error.json.msg : error
  }
  return true
}

export const envClone = async (options: OptionValues, command: BaseCommand) => {
  const { api, site } = command.netlify
  const { force } = options

  if (!site.id && !options.from) {
    log(
      'Please include the source site Id as the `--from` option, or run `netlify link` to link this folder to a Netlify site',
    )
    return false
  }

  const sourceId = options.from || site.id

  if (!sourceId) {
    log(
      'Please include the source site Id as the `--from` option, or run `netlify link` to link this folder to a Netlify site',
    )
  }

  const siteId = {
    from: sourceId,
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

  const success = await cloneEnvVars({ api, siteFrom, siteTo, force })

  if (!success) {
    return false
  }

  log(`Successfully cloned environment variables from ${chalk.green(siteFrom.name)} to ${chalk.green(siteTo.name)}`)

  return true
}
