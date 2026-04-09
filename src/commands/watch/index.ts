import { OptionValues } from 'commander'

import BaseCommand from '../base-command.js'

export const createWatchCommand = (program: BaseCommand) =>
  program
    .command('watch')
    .description('Watch for project deploy to finish')
    .addExamples([`netlify watch`, `git push && netlify watch`])
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { watch } = await import('./watch.js')
      await watch(options, command)
    })
