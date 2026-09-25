import type { NetlifyAPI } from '@netlify/api'

import { chalk, log, logJson } from '../../utils/command-helpers.js'
import { SUPPORTED_CONTEXTS, translateFromEnvelopeToMongo, type EnvelopeItem } from '../../utils/env/index.js'
import { promptOverwriteEnvVariable } from '../../utils/prompts/env-unset-prompts.js'
import type { SiteInfo } from '../../utils/types.js'
import type BaseCommand from '../base-command.js'
import type { EnvUnsetOptionValues } from './option_values.js'
import { getSiteInfo } from './utils.js'
/**
 * Deletes a given key from the env of a site configured with Envelope
 */
const unsetInEnvelope = async ({
  api,
  context,
  force,
  key,
  siteInfo,
}: {
  api: NetlifyAPI
  context?: string[] | undefined
  force?: boolean | undefined
  key: string
  siteInfo: SiteInfo
}): Promise<Record<string, string>> => {
  const accountId = siteInfo.account_slug
  const siteId = siteInfo.id
  // fetch envelope env vars
  const envelopeVariables = (await api.getEnvVars({ accountId, siteId })) as EnvelopeItem[]
  const contexts = context ?? ['all']

  const env = translateFromEnvelopeToMongo(envelopeVariables, context ? context[0] : 'dev')

  // check if the given key exists
  const variable = envelopeVariables.find((envVar) => envVar.key === key)
  if (!variable) {
    // if not, no need to call delete; return early
    return env
  }

  if (!force) {
    await promptOverwriteEnvVariable(key)
  }

  const params = { accountId, siteId, key }
  try {
    if (context) {
      // if context(s) are passed, delete the matching contexts / branches, and the `all` context
      const values = variable.values.filter((val) =>
        ([...contexts, 'all'] as (string | undefined)[]).includes(val.context_parameter || val.context),
      )
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- FIXME: always truthy, `filter` returns an array
      if (values) {
        await Promise.all(
          // @ts-expect-error FIXME(@netlify/api): `envVarValue.id` is typed optional but is always present on returned values
          values.map((value) => api.deleteEnvVarValue({ ...params, id: value.id })),
        )
        // if this was the `all` context, we need to create 3 values in the other contexts
        if (values.length === 1 && values[0].context === 'all') {
          const newContexts = SUPPORTED_CONTEXTS.filter((ctx) => !context.includes(ctx))
          const allValue = values[0].value
          await Promise.all(
            newContexts
              .filter((ctx) => ctx !== 'all')
              .map((ctx) => api.setEnvVarValue({ ...params, body: { context: ctx, value: allValue } })),
          )
        }
      }
    } else {
      // otherwise, if no context passed, delete the whole key
      await api.deleteEnvVar({ accountId, siteId, key })
    }
  } catch (error_) {
    // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
    throw error_.json ? error_.json.msg : error_
  }

  delete env[key]

  return env
}

export const envUnset = async (key: string, options: EnvUnsetOptionValues, command: BaseCommand) => {
  const { context, force } = options
  const { api, cachedConfig, site } = command.netlify
  const siteId = site.id

  if (!siteId) {
    log('No project id found, please run inside a project folder or `netlify link`')
    return false
  }

  const siteInfo = await getSiteInfo(api, siteId, cachedConfig)

  const finalEnv = await unsetInEnvelope({ api, context, force, siteInfo, key })

  // Return new environment variables of site if using json flag
  if (options.json) {
    logJson(finalEnv)
    return false
  }

  const contextType = (SUPPORTED_CONTEXTS as readonly unknown[]).includes(context || 'all') ? 'context' : 'branch'
  log(`Unset environment variable ${chalk.yellow(key)} in the ${chalk.magenta(context || 'all')} ${contextType}`)
  log(`Changes will require a redeploy to take effect on any deployed versions of your project.`)
  return undefined
}
