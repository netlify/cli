import { OptionValues } from 'commander'
import execa from 'execa'

import { getDotEnvVariables, injectEnvVariables } from '../../utils/dev.js'
import { getEnvelopeEnv } from '../../utils/env/index.js'
import BaseCommand from '../base-command.js'

export const devExec = async (cmd: string, options: OptionValues, command: BaseCommand) => {
  const { api, cachedConfig, config, site, siteInfo } = command.netlify

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const withEnvelopeEnvVars = await getEnvelopeEnv({ api, context: options.context, env: cachedConfig.env, siteInfo })
  const withDotEnvVars = await getDotEnvVariables({
    devConfig: { ...config.dev },
    env: withEnvelopeEnvVars,
    site,
  })

  injectEnvVariables(withDotEnvVars)

  await execa(cmd, command.args.slice(1), {
    stdio: 'inherit',
  })
}
