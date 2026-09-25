import type { NetlifyAPI } from '@netlify/api'

import { chalk, log, logAndThrowError } from '../../utils/command-helpers.js'
import type { EnvelopeItem } from '../../utils/env/index.js'
import { promptEnvCloneOverwrite } from '../../utils/prompts/env-clone-prompt.js'
import type { SiteInfo } from '../../utils/types.js'
import type BaseCommand from '../base-command.js'
import type { EnvCloneOptionValues } from './option_values.js'
import { fetchSiteInfo } from './utils.js'

const safeGetSite = async (api: NetlifyAPI, siteId: string): Promise<SiteInfo | undefined> => {
  try {
    return await fetchSiteInfo(api, siteId)
  } catch {
    return undefined
  }
}

/**
 * Copies the env from a project configured with Envelope to a different project configured with Envelope
 */
const cloneEnvVars = async ({
  api,
  force,
  siteFrom,
  siteTo,
}: {
  api: NetlifyAPI
  force?: boolean | undefined
  siteFrom: SiteInfo
  siteTo: SiteInfo
}): Promise<boolean> => {
  const [envelopeFrom, envelopeTo] = await Promise.all([
    api.getEnvVars({ accountId: siteFrom.account_slug, siteId: siteFrom.id }) as Promise<EnvelopeItem[]>,
    api.getEnvVars({ accountId: siteTo.account_slug, siteId: siteTo.id }) as Promise<EnvelopeItem[]>,
  ])

  const keysFrom = envelopeFrom.map(({ key }) => key)

  if (keysFrom.length === 0) {
    log(`${chalk.green(siteFrom.name)} has no environment variables, nothing to clone`)
    return false
  }

  const accountId = siteTo.account_slug
  const siteId = siteTo.id
  const envVarsToDelete = envelopeTo.filter(({ key }) => keysFrom.includes(key))

  if (envVarsToDelete.length !== 0 && !force) {
    await promptEnvCloneOverwrite(siteTo.id, envVarsToDelete)
  }
  // delete marked env vars in parallel
  await Promise.all(envVarsToDelete.map(({ key }) => api.deleteEnvVar({ accountId, siteId, key })))

  // hit create endpoint
  try {
    // @ts-expect-error FIXME(@netlify/api): `createEnvVars` body `scopes` rejects `post_processing`, which Envelope returns and accepts
    await api.createEnvVars({ accountId, siteId, body: envelopeFrom })
  } catch (error) {
    // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
    throw error.json ? error.json.msg : error
  }
  return true
}

export const envClone = async (options: EnvCloneOptionValues, command: BaseCommand) => {
  const { api, site } = command.netlify
  const { force } = options

  if (!site.id && !options.from) {
    log(
      'Please include the source project ID as the `--from` option, or run `netlify link` to link this folder to a Netlify project',
    )
    return false
  }

  const sourceId = options.from || site.id

  if (!sourceId) {
    log(
      'Please include the source project ID as the `--from` option, or run `netlify link` to link this folder to a Netlify project',
    )
  }

  const siteId = {
    // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style -- FIXME: never undefined here, the first guard above already returned
    from: sourceId as string,
    to: options.to,
  }

  const [siteFrom, siteTo] = await Promise.all([safeGetSite(api, siteId.from), safeGetSite(api, siteId.to)])

  if (!siteFrom) {
    return logAndThrowError(
      `Can't find project with id ${chalk.bold(siteId.from)}. Please make sure the project exists.`,
    )
  }

  if (!siteTo) {
    return logAndThrowError(`Can't find project with id ${chalk.bold(siteId.to)}. Please make sure the project exists.`)
  }

  const success = await cloneEnvVars({ api, siteFrom, siteTo, force })

  if (!success) {
    return false
  }

  log(`Successfully cloned environment variables from ${chalk.green(siteFrom.name)} to ${chalk.green(siteTo.name)}`)
  log(`Changes will require a redeploy to take effect on any deployed versions of your project.`)

  return true
}
