import type { NetlifyAPI } from '@netlify/api'

import { chalk, logAndThrowError, log, logJson } from '../../utils/command-helpers.js'
import {
  SUPPORTED_CONTEXTS,
  ALL_ENVELOPE_SCOPES,
  isSupportedContext,
  translateFromEnvelopeToMongo,
  type EnvelopeEnvVarValue,
  type EnvelopeItem,
  type UserProvidedScope,
  type WritableEnvelopeScope,
} from '../../utils/env/index.js'
import { promptOverwriteEnvVariable } from '../../utils/prompts/env-set-prompts.js'
import type { SiteInfo } from '../../utils/types.js'
import type BaseCommand from '../base-command.js'
import type { EnvSetOptionValues } from './option_values.js'
import { getSiteInfo } from './utils.js'

/**
 * Updates the env for a site configured with Envelope with a new key/value pair
 */
const setInEnvelope = async ({
  api,
  context,
  force,
  key,
  scope,
  secret,
  siteInfo,
  value,
}: {
  api: NetlifyAPI
  context?: string[] | undefined
  force?: boolean | undefined
  key: string
  scope?: UserProvidedScope[] | undefined
  secret?: boolean | undefined
  siteInfo: SiteInfo
  value: string
}): Promise<Record<string, string>> => {
  const accountId = siteInfo.account_slug
  const siteId = siteInfo.id

  // secret values may not be used in the post-processing scope
  if (secret && scope?.some((sco) => /post[-_]processing/.test(sco))) {
    return logAndThrowError(`Secret values cannot be used within the post-processing scope.`)
  }

  // secret values must specify deploy contexts. `all` or `dev` are not allowed
  if (secret && value && (!context || context.includes('dev'))) {
    return logAndThrowError(
      `To set a secret environment variable value, please specify a non-development context with the \`--context\` flag.`,
    )
  }

  // fetch envelope env vars
  const envelopeVariables = (await api.getEnvVars({ accountId, siteId })) as EnvelopeItem[]
  const contexts = context || ['all']
  let scopes: readonly WritableEnvelopeScope[] = scope || ALL_ENVELOPE_SCOPES

  if (secret) {
    // post_processing (aka post-processing) scope is not allowed with secrets
    scopes = scopes.filter((sco) => !/post[-_]processing/.test(sco))
  }

  // if the passed context is unknown, it is actually a branch name
  let values: EnvelopeEnvVarValue[] = contexts.map((ctx) =>
    isSupportedContext(ctx) ? { context: ctx, value } : { context: 'branch', context_parameter: ctx, value },
  )

  const existing = envelopeVariables.find((envVar) => envVar.key === key)
  // Checks if --force is passed and if it is an existing variaible, then we need to prompt the user
  if (!force && existing) {
    await promptOverwriteEnvVariable(key)
  }

  const params = { accountId, siteId, key }
  try {
    if (existing) {
      if (!value) {
        values = existing.values
        if (!scope) {
          scopes = existing.scopes
        }
      }
      if (context && scope) {
        return logAndThrowError(
          'Setting the context and scope at the same time on an existing env var is not allowed. Run the set command separately for each update.',
        )
      }
      if (context) {
        // update individual value(s)
        await Promise.all(values.map((val) => api.setEnvVarValue({ ...params, body: val })))
      } else {
        // otherwise update whole env var
        if (secret) {
          scopes = scopes.filter((sco) => !/post[-_]processing/.test(sco))
          const allContextsValue = values.find((val) => val.context === 'all')
          if (allContextsValue) {
            log(`This secret's value will be empty in the dev context.`)
            log(`Run \`netlify env:set ${key} <value> --context dev\` to set a new value for the dev context.`)
            values = SUPPORTED_CONTEXTS.filter((ctx) => ctx !== 'all').map((ctx) => ({
              context: ctx,
              // empty out dev value so that secret is indeed secret
              value: ctx === 'dev' ? '' : allContextsValue.value,
            }))
          }
        }
        const body = { key, is_secret: secret, scopes, values }
        // @ts-expect-error FIXME(@netlify/api): `updateEnvVar` body `scopes` rejects `post_processing`, which Envelope returns and accepts
        await api.updateEnvVar({ ...params, body })
      }
    } else {
      // create whole env var
      const body = [{ key, is_secret: secret, scopes, values }]
      // @ts-expect-error FIXME(@netlify/api): `createEnvVars` body `scopes` rejects `post_processing`, which Envelope returns and accepts
      await api.createEnvVars({ ...params, body })
    }
  } catch (error_) {
    // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
    throw error_.json ? error_.json.msg : error_
  }

  const env = translateFromEnvelopeToMongo(envelopeVariables, context ? context[0] : 'dev')
  return {
    ...env,
    [key]: value || env[key],
  }
}

export const envSet = async (key: string, value: string, options: EnvSetOptionValues, command: BaseCommand) => {
  const { context, force, scope, secret } = options
  const { api, cachedConfig, site } = command.netlify
  const siteId = site.id
  if (!siteId) {
    log('No project id found, please run inside a project folder or `netlify link`')
    return false
  }
  const siteInfo = await getSiteInfo(api, siteId, cachedConfig)

  // Get current environment variables set in the UI
  const finalEnv = await setInEnvelope({ api, siteInfo, force, key, value, context, scope, secret })

  if (!finalEnv) {
    return false
  }

  // Return new environment variables of site if using json flag
  if (options.json) {
    logJson(finalEnv)
    return false
  }

  const contexts = context ?? ['all']
  const withScope = scope ? ` scoped to ${chalk.white(scope.join(','))}` : ''
  const withSecret = secret ? ` as a ${chalk.blue('secret')}` : ''
  const contextType = contexts.every(isSupportedContext) ? 'context' : 'branch'
  log(
    `Set environment variable ${chalk.yellow(
      `${key}${value && !secret ? `=${value}` : ''}`,
    )}${withScope}${withSecret} in the ${chalk.magenta(contexts.join(','))} ${contextType}`,
  )
  log(`Changes will require a redeploy to take effect on any deployed versions of your project.`)
  return undefined
}
