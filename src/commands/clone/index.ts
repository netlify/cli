import terminalLink from 'terminal-link'

import type BaseCommand from '../base-command.js'
import type { CloneOptionValues } from './option_values.js'

export const createCloneCommand = (program: BaseCommand) =>
  program
    .command('clone')
    .description(
      `Clone a repository and link it to a Netlify project

You can clone from:
- A GitHub/GitLab repository URL or shorthand (e.g., owner/repo)
- A Netlify site name (e.g., my-site)
- A Netlify site URL (e.g., https://my-site.netlify.app)

When cloning a Netlify site that has a connected repository, the repository will be cloned from the connected source (GitHub, GitLab, etc.).

When cloning a Netlify site without a connected repository, the repository will be cloned from Netlify's managed git service with automatic credential configuration.

If you specify a target directory, the repo will be cloned into that directory. By default, a directory will be created with the name of the repo or site.`,
    )
    .argument('<repository>', 'Repository URL, GitHub shorthand (owner/repo), Netlify site name, or Netlify site URL')
    .argument('[targetDir]', 'directory in which to clone the repository - will be created if it does not exist')
    .option('--id <id>', 'ID of existing Netlify project to link to (only for GitHub/GitLab repos)')
    .option('--name <name>', 'Name of existing Netlify project to link to (only for GitHub/GitLab repos)')
    .addExamples([
      'netlify clone my-site-name',
      'netlify clone https://my-site.netlify.app',
      'netlify clone https://app.netlify.com/sites/my-site',
      'netlify clone vibecoder/next-unicorn',
      'netlify clone https://github.com/vibecoder/next-unicorn.git',
      'netlify clone my-site-name ./local-folder',
    ])
    .addHelpText('after', () => {
      const docsUrl = 'https://docs.netlify.com/cli/get-started/#link-and-unlink-sites'
      return `For more information about linking projects, see ${terminalLink(docsUrl, docsUrl, { fallback: false })}\n`
    })
    .action(async (repo: string, targetDir: string | undefined, options: CloneOptionValues, command: BaseCommand) => {
      const { clone } = await import('./clone.js')
      await clone(options, command, { repo, targetDir })
    })
