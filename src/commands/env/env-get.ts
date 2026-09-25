import { chalk, log, logJson } from '../../utils/command-helpers.js'
import { getEnvelopeEnv, isSupportedContext } from '../../utils/env/index.js'
import type BaseCommand from '../base-command.js'
import type { EnvGetOptionValues } from './option_values.js'
import { getSiteInfo } from './utils.js'

export const envGet = async (name: string, options: EnvGetOptionValues, command: BaseCommand) => {
  const { context, scope } = options
  const { api, cachedConfig, site } = command.netlify
  const siteId = site.id

  if (!siteId) {
    log('No project id found, please run inside a project folder or `netlify link`')
    return false
  }

  const siteInfo = await getSiteInfo(api, siteId, cachedConfig)
  const env = await getEnvelopeEnv({ api, context, env: cachedConfig.env, key: name, scope, siteInfo })

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- FIXME: `env` has no entry for an unset `name`
  const { value } = env[name] || {}

  // Return json response for piping commands
  if (options.json) {
    logJson(value ? { [name]: value } : {})
    return false
  }

  if (!value) {
    const contextType = isSupportedContext(context) ? 'context' : 'branch'
    const withContext = `in the ${chalk.magenta(context)} ${contextType}`
    const withScope = scope === 'any' ? '' : ` and the ${chalk.magenta(scope)} scope`
    log(`No value set ${withContext}${withScope} for environment variable ${chalk.yellow(name)}`)
    return false
  }

  log(value)
  return undefined
}
