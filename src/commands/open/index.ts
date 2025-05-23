import { OptionValues } from 'commander'

import requiresSiteInfo from '../../utils/hooks/requires-site-info.js'
import BaseCommand from '../base-command.js'

export const createOpenCommand = (program: BaseCommand) => {
  program
    .command('open:admin')
    .description('Opens current project admin UI in Netlify')
    .addExamples(['netlify open:admin'])
    .hook('preAction', requiresSiteInfo)
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { openAdmin } = await import('./open-admin.js')
      await openAdmin(options, command)
    })

  program
    .command('open:site')
    .description('Opens current project url in browser')
    .addExamples(['netlify open:site'])
    .hook('preAction', requiresSiteInfo)
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { openSite } = await import('./open-site.js')
      await openSite(options, command)
    })

  return program
    .command('open')
    .description(`Open settings for the project linked to the current folder`)
    .option('--site', 'Open project')
    .option('--admin', 'Open Netlify project')
    .addExamples(['netlify open --site', 'netlify open --admin', 'netlify open:admin', 'netlify open:site'])
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { open } = await import('./open.js')
      await open(options, command)
    })
}
