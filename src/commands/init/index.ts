import { Option, OptionValues } from 'commander'

import BaseCommand from '../base-command.js'

export const createInitCommand = (program: BaseCommand) =>
  program
    .command('init')
    .description(
      'Configure continuous deployment for a new or existing site. To create a new site without continuous deployment, use `netlify sites:create`',
    )
    .option('-m, --manual', 'Manually configure a git remote for CI')
    .addOption(
      new Option(
        '--gitRemoteName <name>',
        'Old, prefer --git-remote-name. Name of Git remote to use. e.g. "origin"',
      ).hideHelp(true),
    )
    .option('--git-remote-name <name>', 'Name of Git remote to use. e.g. "origin"')
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { init } = await import('./init.js')
      await init(options, command)
    })
