import { OptionValues } from 'commander'

import { chalk, log, logJson } from '../../utils/command-helpers.js'
import { AVAILABLE_CONTEXTS, getEnvelopeEnv } from '../../utils/env/index.js'
import BaseCommand from '../base-command.js'

export const envGet = async (name: string, options: OptionValues, command: BaseCommand) => {
  const { context, scope } = options
  const { api, cachedConfig, site } = command.netlify
  const siteId = site.id

  if (!siteId) {
    log('No site id found, please run inside a site folder or `netlify link`')
    return false
  }

  const { siteInfo } = cachedConfig
  
  const env = await getEnvelopeEnv({ api, context, env: cachedConfig.env, key: name, scope, siteInfo })
  
  const { value } = env[name] || {}

  // Return json response for piping commands
  if (options.json) {
    logJson(value ? { [name]: value } : {})
    return false
  }

  if (!value) {
    const contextType = AVAILABLE_CONTEXTS.includes(context) ? 'context' : 'branch'
    const withContext = `in the ${chalk.magenta(context)} ${contextType}`
    const withScope = scope === 'any' ? '' : ` and the ${chalk.magenta(scope)} scope`
    log(`No value set ${withContext}${withScope} for environment variable ${chalk.yellow(name)}`)
    return false
  }

  log(value)
}
