import type { OptionValues } from 'commander'

import type BaseCommand from '../base-command.js'

export const createCurlCommand = (program: BaseCommand) =>
  program
    .command('curl')
    .description(
      `Run curl with access to projects behind Netlify team login protection
Takes the same arguments as curl.`,
    )
    .argument('<args...>', 'arguments passed to curl')
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .addExamples([
      'netlify curl https://deploy-preview-42--mysitename.netlify.app/',
      'netlify curl -i -X POST -H "Content-Type: application/json" -d \'{"name":"test"}\' https://mysitename.netlify.app/api/items',
    ])
    .action(async (args: string[], options: OptionValues, command: BaseCommand) => {
      const { curl } = await import('./curl.js')
      await curl(args, options, command)
    })
