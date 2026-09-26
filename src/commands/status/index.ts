import requiresSiteInfo from '../../utils/hooks/requires-site-info.js'
import type BaseCommand from '../base-command.js'
import type { StatusHooksOptionValues, StatusOptionValues } from './option_values.js'

export const createStatusCommand = (program: BaseCommand) => {
  program
    .command('status:hooks')
    .description('Print hook information of the linked project')
    .hook('preAction', requiresSiteInfo)
    .action(async (options: StatusHooksOptionValues, command: BaseCommand) => {
      const { statusHooks } = await import('./status-hooks.js')
      await statusHooks(options, command)
    })

  program
    .command('status')
    .description('Print status information')
    .option('--verbose', 'Output system info')
    .option('--json', 'Output status information as JSON')
    .action(async (options: StatusOptionValues, command: BaseCommand) => {
      const { status } = await import('./status.js')
      await status(options, command)
    })
}
