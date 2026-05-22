import type { OptionValues } from 'commander'

import type BaseCommand from '../base-command.js'

export const createSecureStorageCommand = (program: BaseCommand) => {
  program
    .command('secure-storage:status')
    .description(
      `Show the current secure storage status
When enabled, the Netlify auth token is stored in your OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service) instead of in plaintext in the global netlify config file.`,
    )
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { secureStorageStatus } = await import('./secure-storage.js')
      await secureStorageStatus(options, command)
    })

  program
    .command('secure-storage:enable')
    .description(
      `Enable secure storage of the Netlify auth token in the OS keychain
Existing tokens in the global netlify config file are migrated into the keychain.`,
    )
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { secureStorageEnable } = await import('./secure-storage.js')
      await secureStorageEnable(options, command)
    })

  program
    .command('secure-storage:disable')
    .description(
      `Disable secure storage of the Netlify auth token
Tokens previously stored in the OS keychain are moved back to the global netlify config file.`,
    )
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { secureStorageDisable } = await import('./secure-storage.js')
      await secureStorageDisable(options, command)
    })

  return program
    .command('secure-storage')
    .description(
      `Control whether the Netlify auth token is stored in your OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service) instead of in plaintext in the global netlify config file`,
    )
    .addExamples([
      'netlify secure-storage:status',
      'netlify secure-storage:enable',
      'netlify secure-storage:disable',
    ])
    .action((_options: OptionValues, command: BaseCommand) => {
      command.help()
    })
}
