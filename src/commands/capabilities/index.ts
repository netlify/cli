import { OptionValues } from 'commander'

import BaseCommand from '../base-command.js'

export const createCapabilitiesCommand = (program: BaseCommand) => {
  program
    .command('capabilities')
    .description(
      'Print a machine-readable manifest of every command, its flags, exit codes, env vars, and config files\nIntended for scripts and AI agents. Output is always JSON on stdout.',
    )
    .option('--json', 'Output capabilities as JSON (the default; this command always outputs JSON)')
    .addExamples(['netlify capabilities', 'netlify capabilities --json'])
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { capabilities } = await import('./capabilities.js')
      await capabilities(options, command)
    })
}
