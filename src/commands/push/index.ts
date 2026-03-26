import type { OptionValues } from 'commander'

import BaseCommand from '../base-command.js'

export const createPushCommand = (program: BaseCommand) =>
  program
    .command('push')
    .description('Push code to Netlify via git, triggering a build')
    .option('-m, --message <message>', 'Commit message')
    .addExamples(['netlify push', 'netlify push -m "Add contact form"'])
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { push } = await import('./push.js')
      await push(options, command)
    })
