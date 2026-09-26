import type BaseCommand from '../base-command.js'
import type { WatchOptionValues } from './option_values.js'

export const createWatchCommand = (program: BaseCommand) =>
  program
    .command('watch')
    .description('Watch for project deploy to finish')
    .addExamples([`netlify watch`, `git push && netlify watch`])
    .action(async (options: WatchOptionValues, command: BaseCommand) => {
      const { watch } = await import('./watch.js')
      await watch(options, command)
    })
