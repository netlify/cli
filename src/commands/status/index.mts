import { OptionValues } from 'commander'

import requiresSiteInfo from '../../utils/hooks/requires-site-info.mjs'
import BaseCommand from '../base-command.mjs'

export const createStatusCommand = (program: BaseCommand) => {
  program
    .command('status:hooks')
    .description('Print hook information of the linked site')
    .hook('preAction', requiresSiteInfo)
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { statusHooks } = await import('./status-hooks.mjs')
      await statusHooks(options, command)
    })

  return program
    .command('status')
    .description('Print status information')
    .option('--verbose', 'Output system info')
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { status } = await import('./status.mjs')
      await status(options, command)
    })
}
