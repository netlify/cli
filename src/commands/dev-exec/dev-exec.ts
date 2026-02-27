import { OptionValues } from 'commander'
import execa from 'execa'

import { parseAIGatewayContext, setupAIGateway } from '@netlify/ai/bootstrap'

import { NETLIFYDEVLOG, log } from '../../utils/command-helpers.js'
import { getDotEnvVariables, getSiteInformation, injectEnvVariables } from '../../utils/dev.js'
import { getEnvelopeEnv } from '../../utils/env/index.js'
import BaseCommand from '../base-command.js'

export const devExec = async (cmd: string, options: OptionValues, command: BaseCommand) => {
  const { api, cachedConfig, config, site, siteInfo } = command.netlify

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const withEnvelopeEnvVars = await getEnvelopeEnv({ api, context: options.context, env: cachedConfig.env, siteInfo })
  const env = await getDotEnvVariables({
    devConfig: { framework: '#auto', ...config.dev },
    env: withEnvelopeEnvVars,
    site,
  })

  const { capabilities, siteUrl } = await getSiteInformation({
    offline: false,
    api,
    site,
    siteInfo,
  })

  if (!capabilities.aiGatewayDisabled) {
    await setupAIGateway({ api, env, siteID: site.id, siteURL: siteUrl })

    const aiGatewayEnv = env.AI_GATEWAY as (typeof env)[string] | undefined
    if (aiGatewayEnv) {
      const aiGatewayContext = parseAIGatewayContext(aiGatewayEnv.value)
      if (aiGatewayContext?.envVars) {
        for (const envVar of aiGatewayContext.envVars) {
          env[envVar.key] = { sources: ['internal'], value: aiGatewayContext.token }
          env[envVar.url] = { sources: ['internal'], value: aiGatewayContext.url }
        }
      }
    }
  } else {
    log(`${NETLIFYDEVLOG} AI Gateway is disabled for this account`)
  }

  injectEnvVariables(env)

  await execa(cmd, command.args.slice(1), {
    stdio: 'inherit',
  })
}
