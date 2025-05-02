import { OptionValues } from 'commander'
import terminalLink from 'terminal-link'

import BaseCommand from '../base-command.js'

export const createUnlinkCommand = (program: BaseCommand) =>
  program
    .command('unlink')
    .description('Unlink a local folder from a Netlify site')
    .addHelpText('after', () => {
      const docsUrl = 'https://docs.netlify.com/cli/site-management/#unlink-a-site'
      return `
For more information about linking sites, see ${terminalLink(docsUrl, docsUrl)}
`
    })
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { unlink } = await import('./unlink.js')
      await unlink(options, command)
    })
