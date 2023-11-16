
import { OptionValues } from 'commander'

import BaseCommand from '../base-command.mjs'

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

  program
  .command('lm:install', { hidden: true })
  .alias('lm:init')
  .description(
    `Configures your computer to use Netlify Large Media
It installs the required credentials helper for Git,
and configures your Git environment with the right credentials.`,
  )
  .option('-f, --force', 'Force the credentials helper installation')
  .action(async (options: OptionValues) => {
    const { lmInstall } = await import('./lm-install.mjs')
    await lmInstall(options)
  })

  program
    .command('lm:setup', { hidden: true })
    .description('Configures your site to use Netlify Large Media')
    .option('-s, --skip-install', 'Skip the credentials helper installation check')
    .option('-f, --force-install', 'Force the credentials helper installation')
    .addHelpText('after', 'It runs the install command if you have not installed the dependencies yet.')
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { lmSetup } = await import('./lm-setup.mjs')
      await lmSetup(options, command)
    })


  createLmUninstallCommand(program)

  program
    .command('lm', { hidden: true })
    .description(
      '[Deprecated and will be removed from future versions] Handle Netlify Large Media operations\nThe lm command will help you manage large media for a site',
    )
    .addExamples(['netlify lm:info', 'netlify lm:install', 'netlify lm:setup'])
    .action(lm)
}
