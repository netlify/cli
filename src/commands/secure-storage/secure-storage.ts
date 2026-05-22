import type { OptionValues } from 'commander'

import {
  deleteTokenFromKeychain,
  getTokenFromKeychain,
  isKeychainAvailable,
  isSecureStorageEnabled,
  setSecureStorageEnabledFlag,
  storeTokenInKeychain,
} from '../../lib/secure-storage.js'
import { chalk, log, logAndThrowError } from '../../utils/command-helpers.js'
import type BaseCommand from '../base-command.js'

type StoredUser = {
  id: string
  email?: string
  name?: string
  auth?: { token?: string }
}

const getStoredUsers = (globalConfig: BaseCommand['netlify']['globalConfig']): StoredUser[] => {
  const users = (globalConfig.get('users') ?? {}) as Record<string, StoredUser | undefined>
  return Object.values(users).filter((user): user is StoredUser => Boolean(user?.id))
}

export const secureStorageStatus = async (_options: OptionValues, command: BaseCommand) => {
  const { globalConfig } = command.netlify
  const enabled = isSecureStorageEnabled(globalConfig)
  const available = await isKeychainAvailable()

  log(`Secure storage: ${enabled ? chalk.greenBright('enabled') : chalk.yellow('disabled')}`)
  log(
    `OS keychain available: ${
      available ? chalk.greenBright('yes') : chalk.yellow('no (keychain access failed on this system)')
    }`,
  )

  if (enabled && !available) {
    log()
    log(
      chalk.yellow(
        'Warning: secure storage is enabled but the OS keychain is not reachable. The CLI will fall back to the plaintext token in your config file.',
      ),
    )
  }
}

export const secureStorageEnable = async (_options: OptionValues, command: BaseCommand) => {
  const { globalConfig } = command.netlify

  if (isSecureStorageEnabled(globalConfig)) {
    log('Secure storage is already enabled.')
    return
  }

  if (!(await isKeychainAvailable())) {
    return logAndThrowError(
      `Cannot enable secure storage: this OS keychain is not reachable.
On Linux, install ${chalk.cyanBright('libsecret')} and ensure a Secret Service provider (e.g. gnome-keyring, KWallet) is running.`,
    )
  }

  const users = getStoredUsers(globalConfig)
  const migrated: string[] = []
  const failed: string[] = []

  for (const user of users) {
    const token = user.auth?.token
    if (!token) continue
    const ok = await storeTokenInKeychain(user.id, token)
    if (ok) {
      globalConfig.set(`users.${user.id}.auth.token`, undefined)
      migrated.push(user.email ?? user.id)
    } else {
      failed.push(user.email ?? user.id)
    }
  }

  setSecureStorageEnabledFlag(globalConfig, true)

  log(chalk.greenBright('Secure storage enabled.'))
  log('New auth tokens will be stored in your OS keychain instead of the plaintext config file.')
  if (migrated.length > 0) {
    log(`Migrated tokens to the keychain for: ${migrated.join(', ')}`)
  }
  if (failed.length > 0) {
    log(
      chalk.yellow(
        `Could not migrate tokens for: ${failed.join(', ')}. These tokens remain in the plaintext config file.`,
      ),
    )
  }
}

export const secureStorageDisable = async (_options: OptionValues, command: BaseCommand) => {
  const { globalConfig } = command.netlify

  if (!isSecureStorageEnabled(globalConfig)) {
    log('Secure storage is already disabled.')
    return
  }

  const users = getStoredUsers(globalConfig)
  const migrated: string[] = []

  for (const user of users) {
    const token = await getTokenFromKeychain(user.id)
    if (!token) continue
    globalConfig.set(`users.${user.id}.auth.token`, token)
    await deleteTokenFromKeychain(user.id)
    migrated.push(user.email ?? user.id)
  }

  setSecureStorageEnabledFlag(globalConfig, false)

  log(chalk.greenBright('Secure storage disabled.'))
  log(chalk.yellow('Auth tokens are now stored in plaintext in your global netlify config file.'))
  if (migrated.length > 0) {
    log(`Moved tokens back to the config file for: ${migrated.join(', ')}`)
  }
}
