import path from 'path'

import { getAPIToken, getGlobalConfigStore, type GlobalConfigStore } from '@netlify/dev-utils'
import envPaths from 'env-paths'
import inquirer from 'inquirer'

import { chalk, log } from '../utils/command-helpers.js'
import { isInteractive } from '../utils/scripted-commands.js'
import { track } from '../utils/telemetry/index.js'

const SERVICE_NAME = 'netlify-cli'
const SMOKETEST_ACCOUNT = '__netlify_cli_smoketest__'
const MIGRATION_DECLINED_KEY = 'auth.keychainMigrationDeclined'

export const LEGACY_STORAGE_ENV_VAR = 'NETLIFY_USE_LEGACY_AUTH_STORAGE'

export type TokenStorageMode = 'keychain' | 'legacy'

type KeyringModule = typeof import('@napi-rs/keyring')

let keyringPromise: Promise<KeyringModule | null> | undefined
let migrationPromptedThisSession = false

export const getLegacyConfigFilePath = (): string => {
  const paths = envPaths('netlify', { suffix: '' })
  return path.join(paths.config, 'config.json')
}

const loadKeyring = (): Promise<KeyringModule | null> => {
  if (keyringPromise == null) {
    keyringPromise = import('@napi-rs/keyring').catch(() => null)
  }
  return keyringPromise
}

const createEntry = async (userId: string) => {
  const keyring = await loadKeyring()
  if (!keyring) return null
  try {
    return new keyring.Entry(SERVICE_NAME, userId)
  } catch {
    return null
  }
}

export const isLegacyAuthStorageForced = (): boolean =>
  process.env[LEGACY_STORAGE_ENV_VAR] != null && process.env[LEGACY_STORAGE_ENV_VAR] !== ''

export const isKeychainAvailable = async (): Promise<boolean> => {
  const keyring = await loadKeyring()
  if (!keyring) return false

  try {
    const entry = new keyring.Entry(SERVICE_NAME, SMOKETEST_ACCOUNT)
    entry.setPassword('ok')
    const value = entry.getPassword()
    entry.deletePassword()
    return value === 'ok'
  } catch {
    return false
  }
}

export const storeTokenInKeychain = async (userId: string, token: string): Promise<boolean> => {
  const entry = await createEntry(userId)
  if (!entry) return false
  try {
    entry.setPassword(token)
    return true
  } catch {
    return false
  }
}

export const getTokenFromKeychain = async (userId: string): Promise<string | null> => {
  const entry = await createEntry(userId)
  if (!entry) return null
  try {
    return entry.getPassword()
  } catch {
    return null
  }
}

export const deleteTokenFromKeychain = async (userId: string): Promise<boolean> => {
  const entry = await createEntry(userId)
  if (!entry) return false
  try {
    return entry.deletePassword()
  } catch {
    return false
  }
}

const trackStored = (mode: TokenStorageMode, migrated: boolean, keychainFailed = false): void => {
  void track('user_authTokenStored', { mode, migrated, ...(keychainFailed ? { keychainFailed: true } : {}) })
}

const trackRead = (mode: TokenStorageMode): void => {
  void track('user_authTokenRead', { mode })
}

const promptForMigration = async (): Promise<boolean> => {
  log()
  log(
    `Your Netlify auth token is currently stored in plaintext at ${chalk.cyanBright(getLegacyConfigFilePath())}.`,
  )
  log(`The CLI can move it to your OS keychain (more secure). Your operating system may prompt you to allow access.`)
  log()
  try {
    const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Move the token to the keychain now?',
        default: true,
      },
    ])
    return confirm
  } catch {
    return false
  }
}

const attemptMigration = async (
  userId: string,
  token: string,
  globalConfig: GlobalConfigStore,
): Promise<boolean> => {
  if (!isInteractive()) return false
  if (migrationPromptedThisSession) return false
  if (globalConfig.get(MIGRATION_DECLINED_KEY) === true) return false

  migrationPromptedThisSession = true

  const confirmed = await promptForMigration()
  if (!confirmed) {
    globalConfig.set(MIGRATION_DECLINED_KEY, true)
    void track('user_authTokenMigrationDeclined', {})
    return false
  }

  const ok = await storeTokenInKeychain(userId, token)
  if (!ok) {
    log(chalk.yellow('Could not write to the OS keychain. Keeping the token in the config file.'))
    trackStored('legacy', false, true)
    return false
  }
  globalConfig.set(`users.${userId}.auth.token`, undefined)
  log(chalk.green('Auth token moved to the OS keychain.'))
  trackStored('keychain', true)
  return true
}

export const getStoredAPIToken = async (): Promise<{ token: string | undefined; fromKeychain: boolean }> => {
  const globalConfig = await getGlobalConfigStore()
  const userId = globalConfig.get('userId') as string | undefined

  if (isLegacyAuthStorageForced()) {
    const token = await getAPIToken()
    if (token) trackRead('legacy')
    return { token, fromKeychain: false }
  }

  if (userId) {
    const keychainToken = await getTokenFromKeychain(userId)
    if (keychainToken) {
      trackRead('keychain')
      return { token: keychainToken, fromKeychain: true }
    }
  }

  const legacyToken = await getAPIToken()
  if (!legacyToken) {
    return { token: undefined, fromKeychain: false }
  }

  if (userId) {
    const migrated = await attemptMigration(userId, legacyToken, globalConfig)
    if (migrated) {
      return { token: legacyToken, fromKeychain: true }
    }
  }
  trackRead('legacy')
  return { token: legacyToken, fromKeychain: false }
}

export const writeAuthTokenForStorage = async (
  userId: string,
  accessToken: string,
): Promise<{ mode: TokenStorageMode; keychainFailed: boolean }> => {
  if (isLegacyAuthStorageForced()) {
    trackStored('legacy', false)
    return { mode: 'legacy', keychainFailed: false }
  }

  const ok = await storeTokenInKeychain(userId, accessToken)
  if (ok) {
    trackStored('keychain', false)
    return { mode: 'keychain', keychainFailed: false }
  }

  trackStored('legacy', false, true)
  return { mode: 'legacy', keychainFailed: true }
}

