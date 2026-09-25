import terminalLink from 'terminal-link'

import type BaseCommand from '../base-command.js'
import type { InitOptionValues } from './init.js'

export const createInitCommand = (program: BaseCommand) =>
  program
    .command('init')
    .description(
      'Configure continuous deployment for a new or existing project. To create a new project without continuous deployment, use `netlify sites:create`',
    )
    .option('-m, --manual', 'Manually configure a git remote for CI')
    .option('--git-remote-name <name>', 'Name of Git remote to use. e.g. "origin"')
    .addHelpText('after', () => {
      const docsUrl = 'https://docs.netlify.com/cli/get-started/'
      return `
For more information about getting started with Netlify CLI, see ${terminalLink(docsUrl, docsUrl, { fallback: false })}
`
    })
    .action(async (options: InitOptionValues, command: BaseCommand) => {
      const { init } = await import('./init.js')
      await init(options, command)
    })
