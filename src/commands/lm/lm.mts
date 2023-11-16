
import { OptionValues } from 'commander'

import BaseCommand from '../base-command.mjs'

import { createLmInstallCommand } from './lm-install.mjs'
import { createLmSetupCommand } from './lm-setup.mjs'
import { createLmUninstallCommand } from './lm-uninstall.mjs'


const lm = (options: OptionValues, command: BaseCommand) => {
  command.help()
}


export const createLmCommand = (program: BaseCommand) => {
  program
  .command('lm:info', { hidden: true })
  .description('Show large media requirements information.')
  .action(async () => {
    const { lmInfo } = await import('./lm-info.mjs')
    await lmInfo()
  })

  createLmInstallCommand(program)
  createLmSetupCommand(program)
  createLmUninstallCommand(program)

  program
    .command('lm', { hidden: true })
    .description(
      '[Deprecated and will be removed from future versions] Handle Netlify Large Media operations\nThe lm command will help you manage large media for a site',
    )
    .addExamples(['netlify lm:info', 'netlify lm:install', 'netlify lm:setup'])
    .action(lm)
}
