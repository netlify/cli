import { getAPIToken, getGlobalConfigStore, type GlobalConfigStore } from '@netlify/dev-utils'

import { isInteractive } from '../utils/scripted-commands.js'
import { track } from '../utils/telemetry/index.js'

const SERVICE_NAME = 'netlify-cli'
const SMOKETEST_ACCOUNT = '__netlify_cli_smoketest__'

// Setting this env var falls back to the legacy behavior of storing the auth token
// in plaintext in the global netlify config file. Intended as a temporary escape hatch.
export const LEGACY_STORAGE_ENV_VAR = 'NETLIFY_USE_LEGACY_AUTH_STORAGE'

export type TokenStorageMode = 'keychain' | 'legacy'

type KeyringModule = typeof import('@napi-rs/keyring')

let keyringPromise: Promise<KeyringModule | null> | undefined

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

const attemptSilentMigration = async (
  userId: string,
  token: string,
  globalConfig: GlobalConfigStore,
): Promise<boolean> => {
  if (!isInteractive()) return false
  const ok = await storeTokenInKeychain(userId, token)
  if (!ok) {
    trackStored('legacy', false, true)
    return false
  }
  globalConfig.set(`users.${userId}.auth.token`, undefined)
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
    const migrated = await attemptSilentMigration(userId, legacyToken, globalConfig)
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
