import { OptionValues } from 'commander'

import { chalk, log, logJson } from '../../utils/command-helpers.js'
import { SUPPORTED_CONTEXTS, getEnvelopeEnv } from '../../utils/env/index.js'
import BaseCommand from '../base-command.js'
import { failNotLinked, getEnvSiteId, getSiteInfo } from './utils.js'

export const envGet = async (name: string, options: OptionValues, command: BaseCommand) => {
  const { context, scope } = options
  const { api, cachedConfig } = command.netlify
  const siteId = getEnvSiteId(options, command)

  if (!siteId) {
    return failNotLinked(options)
  }

  const siteInfo = await getSiteInfo(api, siteId, cachedConfig)
  const env = await getEnvelopeEnv({ api, context, env: cachedConfig.env, key: name, scope, siteInfo })

  // @ts-expect-error FIXME(ndhoule)
  const { value } = env[name] || {}

  // Return json response for piping commands
  if (options.json) {
    logJson(value ? { [name]: value } : {})
    return false
  }

  if (!value) {
    const contextType = SUPPORTED_CONTEXTS.includes(context) ? 'context' : 'branch'
    const withContext = `in the ${chalk.magenta(context)} ${contextType}`
    const withScope = scope === 'any' ? '' : ` and the ${chalk.magenta(scope)} scope`
    log(`No value set ${withContext}${withScope} for environment variable ${chalk.yellow(name)}`)
    return false
  }

  log(value)
}
