import { OptionValues } from 'commander'
import execa from 'execa'

import { getDotEnvVariables, injectEnvVariables } from '../../utils/dev.js'
import { getEnvelopeEnv } from '../../utils/env/index.js'
import BaseCommand from '../base-command.js'

export const devExec = async (cmd: string, options: OptionValues, command: BaseCommand) => {
  const { api, cachedConfig, config, site, siteInfo } = command.netlify

  let { env } = cachedConfig
  if (siteInfo.use_envelope) {
    env = await getEnvelopeEnv({ api, context: options.context, env, siteInfo })
  }

  env = await getDotEnvVariables({ devConfig: { ...config.dev }, env, site })
  injectEnvVariables(env)

  await execa(cmd, command.args.slice(1), {
    stdio: 'inherit',
  })
}
