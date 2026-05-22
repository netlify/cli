import type { OptionValues } from 'commander'

import type BaseCommand from '../base-command.js'

export const createSecureStorageCommand = (program: BaseCommand) => {
  program
    .command('secure-storage:status')
    .description(
      `Show where the Netlify auth token is stored on this machine
By default the token is stored in your OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service). If the keychain is unreachable, the CLI falls back to the global netlify config file. Set NETLIFY_USE_LEGACY_AUTH_STORAGE=1 to force the legacy plaintext mode.`,
    )
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { secureStorageStatus } = await import('./secure-storage.js')
      await secureStorageStatus(options, command)
    })

  return program
    .command('secure-storage')
    .description(
      `Inspect where the Netlify auth token is stored on this machine. By default tokens are stored in your OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)`,
    )
    .addExamples(['netlify secure-storage:status'])
    .action((_options: OptionValues, command: BaseCommand) => {
      command.help()
    })
}
