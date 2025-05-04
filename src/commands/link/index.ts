import terminalLink from 'terminal-link'

import BaseCommand from '../base-command.js'
import type { LinkOptionValues } from './option_values.js'

export const createLinkCommand = (program: BaseCommand) =>
  program
    .command('link')
    .description('Link a local repo or project folder to an existing site on Netlify')
    .option('--id <id>', 'ID of site to link to')
    .option('--name <name>', 'Name of site to link to')
    .option('--git-remote-name <name>', 'Name of Git remote to use. e.g. "origin"')
    .addExamples(['netlify link', 'netlify link --id 123-123-123-123', 'netlify link --name my-site-name'])
    .addHelpText('after', () => {
      const docsUrl = 'https://docs.netlify.com/cli/get-started/#link-and-unlink-sites'
      return `
For more information about linking sites, see ${terminalLink(docsUrl, docsUrl)}
`
    })
    .action(async (options: LinkOptionValues, command: BaseCommand) => {
      const { link } = await import('./link.js')
      await link(options, command)
    })
