import { OptionValues } from "commander";

import BaseCommand from "../base-command.mjs";

export const createWatchCommand = (program: BaseCommand) =>
  program
    .command('watch')
    .description('Watch for site deploy to finish')
    .addExamples([`netlify watch`, `git push && netlify watch`])
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { watch } = await import('./watch.mjs')
      await watch(options, command)
    })
