import { OptionValues } from 'commander'
import execa from 'execa'

import { parseAIGatewayContext, setupAIGateway } from '@netlify/ai/bootstrap'

import { getDotEnvVariables, getSiteInformation, injectEnvVariables } from '../../utils/dev.js'
import { getEnvelopeEnv } from '../../utils/env/index.js'
import BaseCommand from '../base-command.js'

export const devExec = async (cmd: string, options: OptionValues, command: BaseCommand) => {
  const { api, cachedConfig, config, site, siteInfo } = command.netlify

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const withEnvelopeEnvVars = await getEnvelopeEnv({ api, context: options.context, env: cachedConfig.env, siteInfo })
  const env = await getDotEnvVariables({ devConfig: { ...config.dev }, env: withEnvelopeEnvVars, site })

  const { capabilities, siteUrl } = await getSiteInformation({
    offline: false,
    api,
    site,
    siteInfo,
  })

  if (!capabilities.aiGatewayDisabled) {
    await setupAIGateway({ api, env, siteID: site.id, siteURL: siteUrl })

    // Parse AI Gateway context and inject provider API keys
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- AI_GATEWAY is conditionally set by setupAIGateway
    if (env.AI_GATEWAY) {
      const aiGatewayContext = parseAIGatewayContext(env.AI_GATEWAY.value)
      if (aiGatewayContext?.envVars) {
        for (const envVar of aiGatewayContext.envVars) {
          env[envVar.key] = { sources: ['internal'], value: aiGatewayContext.token }
          env[envVar.url] = { sources: ['internal'], value: aiGatewayContext.url }
        }
      }
    }
  }

  injectEnvVariables(env)

  await execa(cmd, command.args.slice(1), {
    stdio: 'inherit',
  })
}
