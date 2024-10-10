import { OptionValues } from 'commander'
import execa from 'execa'

import { getDotEnvVariables, injectEnvVariables } from '../../utils/dev.js'
import { getEnvelopeEnv, normalizeContext } from '../../utils/env/index.js'
import BaseCommand from '../base-command.js'

export const devExec = async (cmd: string, options: OptionValues, command: BaseCommand) => {
  const { api, cachedConfig, config, site, siteInfo } = command.netlify

  const withEnvelopeEnvVars = await getEnvelopeEnv({ api, context: options.context, env: cachedConfig.env, siteInfo })
  const withDotEnvVars = await getDotEnvVariables({ devConfig: { ...config.dev }, env: withEnvelopeEnvVars, site })

  injectEnvVariables(withDotEnvVars)

  await execa(cmd, command.args.slice(1), {
    stdio: 'inherit',
  })
}

export const createDevExecCommand = (program: BaseCommand) =>
  program
    .command('dev:exec')
    .argument('<...cmd>', `the command that should be executed`)
    .option(
      '--context <context>',
      'Specify a deploy context or branch for environment variables (contexts: "production", "deploy-preview", "branch-deploy", "dev")',
      normalizeContext,
      'dev',
    )
    .description('Runs a command within the netlify dev environment. For example, with environment variables from any installed add-ons')
    .allowExcessArguments(true)
    .addExamples(['netlify dev:exec npm run bootstrap'])
    .action(devExec)
