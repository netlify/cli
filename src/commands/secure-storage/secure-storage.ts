import type { OptionValues } from 'commander'

import {
  LEGACY_STORAGE_ENV_VAR,
  getTokenFromKeychain,
  isKeychainAvailable,
  isLegacyAuthStorageForced,
} from '../../lib/secure-storage.js'
import { chalk, log } from '../../utils/command-helpers.js'
import type BaseCommand from '../base-command.js'

export const secureStorageStatus = async (_options: OptionValues, command: BaseCommand) => {
  const { globalConfig } = command.netlify
  const userId = globalConfig.get('userId') as string | undefined

  const legacyForced = isLegacyAuthStorageForced()
  const keychainAvailable = await isKeychainAvailable()

  const keychainToken = legacyForced || !userId ? null : await getTokenFromKeychain(userId)
  const legacyToken = (userId ? globalConfig.get(`users.${userId}.auth.token`) : undefined) as string | undefined

  log(`Keychain available: ${keychainAvailable ? chalk.greenBright('yes') : chalk.yellow('no')}`)
  log(
    `Legacy plaintext mode forced via ${chalk.cyanBright(LEGACY_STORAGE_ENV_VAR)}: ${
      legacyForced ? chalk.yellow('yes') : chalk.greenBright('no')
    }`,
  )

  if (!userId) {
    log()
    log('Not logged in.')
    return
  }

  if (keychainToken) {
    log(`Current token: stored in ${chalk.greenBright('OS keychain')} (secure)`)
  } else if (legacyToken) {
    log(`Current token: stored in ${chalk.yellow('plaintext config file')} (legacy)`)
    if (!legacyForced && keychainAvailable) {
      log(chalk.dim('The token will be migrated to the keychain automatically on next use.'))
    }
  } else {
    log('Current token: not found.')
  }
}
