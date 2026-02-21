import { OptionValues, Option } from 'commander'
import terminalLink from 'terminal-link'

import BaseCommand from '../base-command.js'

export const createInitCommand = (program: BaseCommand) =>
  program
    .command('init')
    .description(
      'Configure continuous deployment for a new or existing project. To create a new project without continuous deployment, use `netlify sites:create`',
    )
    .option('-m, --manual', 'Manually configure a git remote for CI')
    .option('--git-remote-name <name>', 'Name of Git remote to use. e.g. "origin"')
    .addOption(new Option('--ai-rules <hash>', 'Initialize with AI project configuration (experimental)').hideHelp())
    .addHelpText('after', () => {
      const docsUrl = 'https://docs.netlify.com/cli/get-started/'
      return `
For more information about getting started with Netlify CLI, see ${terminalLink(docsUrl, docsUrl, { fallback: false })}
`
    })
    .action(async (options: OptionValues, command: BaseCommand) => {
      // Check for experimental AI rules flag
      if (options.aiRules) {
        const { initWithAiRules } = await import('./ai-rules.js')
        await initWithAiRules(options.aiRules as string, command)
        return
      }

      // Standard init flow
      const { init } = await import('./init.js')
      await init(options, command)
    })
