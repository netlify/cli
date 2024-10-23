import { OptionValues } from 'commander'

import { chalk, log, logJson } from '../../utils/command-helpers.js'
import { AVAILABLE_CONTEXTS, translateFromEnvelopeToMongo, isAPIEnvError } from '../../utils/env/index.js'
import BaseCommand from '../base-command.js'
import type { EnviromentVariables } from '../types.d.ts'

import type { UnsetInEnvelopeParams } from './types.d.ts'

/**
 * Deletes a given key from the env of a site configured with Envelope
 * @returns {Promise<object>}
 */

const unsetInEnvelope = async ({
  api,
  context,
  key,
  siteInfo,
}: UnsetInEnvelopeParams): Promise<EnviromentVariables> => {
  const accountId = siteInfo.account_slug
  const siteId = siteInfo.id
  console.log('siteId is type of', typeof siteId)
  // fetch envelope env vars
  const envelopeVariables = await api.getEnvVars({ accountId, siteId })
  const contexts = context || ['all']

  const env = translateFromEnvelopeToMongo(envelopeVariables, context ? context[0] : 'dev')

  // check if the given key exists
  const variable = envelopeVariables.find((envVar) => envVar.key === key)
  if (!variable) {
    // if not, no need to call delete; return early
    return env
  }

  const params = { accountId, siteId, key }
  try {
    if (context) {
      // if context(s) are passed, delete the matching contexts / branches, and the `all` context
      const values = variable.values.filter((val) =>
        [...contexts, 'all'].includes(val.context_parameter || val.context),
      )
      if (values) {
        await Promise.all(values.map((value) => api.deleteEnvVarValue({ ...params, id: value.id })))
        // if this was the `all` context, we need to create 3 values in the other contexts
        if (values.length === 1 && values[0].context === 'all') {
          const newContexts = AVAILABLE_CONTEXTS.filter((ctx) => !context.includes(ctx))
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
    const errortoThrow = isAPIEnvError(error_) ? error_.json.msg : error_
    throw errortoThrow
  }

  delete env[key]

  return env
}

export const envUnset = async (key: string, options: OptionValues, command: BaseCommand) => {
  const { context } = options
  const { api, cachedConfig, site } = command.netlify
  const siteId = site.id

  if (!siteId) {
    log('No site id found, please run inside a site folder or `netlify link`')
    return false
  }

  const { siteInfo } = cachedConfig

  const finalEnv = await unsetInEnvelope({ api, context, siteInfo, key })

  // Return new environment variables of site if using json flag
  if (options.json) {
    logJson(finalEnv)
    return false
  }

  const contextType = AVAILABLE_CONTEXTS.includes(context || 'all') ? 'context' : 'branch'
  log(`Unset environment variable ${chalk.yellow(key)} in the ${chalk.magenta(context || 'all')} ${contextType}`)
}
