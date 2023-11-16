import { OptionValues } from "commander";

import BaseCommand from "../base-command.mjs";

export const createUnlinkCommand = (program: BaseCommand) =>
  program.
  command('unlink')
  .description('Unlink a local folder from a Netlify site')
  .action(async (options: OptionValues, command: BaseCommand) => {
    const { unlink } = await import('./unlink.mjs')
    await unlink(options, command)
  })
