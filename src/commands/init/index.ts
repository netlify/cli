import { OptionValues } from 'commander'
import terminalLink from 'terminal-link'

import BaseCommand from '../base-command.js'

export const createInitCommand = (program: BaseCommand) =>
  program
    .command('init')
    .description(
      `Initialize a Netlify project in the current directory

Links this directory to a new or existing Netlify project and saves the project ID locally.
\`netlify init\` can be used with or without Git/continuous deployment.

The init command can:
- Create a new Netlify project, or link to an existing one
- Add \`.netlify/\` to \`.gitignore\`
- Create or update \`netlify.toml\` with detected build settings (optional)
- Connect a Git repository for continuous deployment (optional)

If no Git remote is detected, you can still create a project and deploy manually with \`netlify deploy\`.`,
    )
    .option('-m, --manual', 'Manually configure a git remote for CI')
    .option('--git-remote-name <name>', 'Name of Git remote to use. e.g. "origin"')
    .addExamples([
      'netlify init',
      'netlify init --manual',
      'netlify init --force',
      'netlify init --git-remote-name upstream',
    ])
    .addHelpText('after', () => {
      const docsUrl = 'https://docs.netlify.com/cli/get-started/'
      return `
For more information about getting started with Netlify CLI, see ${terminalLink(docsUrl, docsUrl, { fallback: false })}
`
    })
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { init } = await import('./init.js')
      await init(options, command)
    })
