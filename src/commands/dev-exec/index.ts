import type { OptionValues } from 'commander'

import type BaseCommand from '../base-command.js'
import { normalizeContext } from '../../utils/env/index.js'

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
    .description(
      'Runs a command within the netlify dev environment. For example, with environment variables from any installed add-ons',
    )
    .allowExcessArguments(true)
    .addExamples(['netlify dev:exec npm run bootstrap'])
    .action(async (cmd: string, options: OptionValues, command: BaseCommand) => {
      const { devExec } = await import('./dev-exec.js')
      await devExec(cmd, options, command)
    })
