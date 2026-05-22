import { getAPIToken, getGlobalConfigStore, type GlobalConfigStore } from '@netlify/dev-utils'

const SERVICE_NAME = 'netlify-cli'
const SECURE_STORAGE_ENABLED_KEY = 'secureStorage.enabled'
const SMOKETEST_ACCOUNT = '__netlify_cli_smoketest__'

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

export const isSecureStorageEnabled = (globalConfig: GlobalConfigStore): boolean =>
  Boolean(globalConfig.get(SECURE_STORAGE_ENABLED_KEY))

export const setSecureStorageEnabledFlag = (globalConfig: GlobalConfigStore, enabled: boolean): void => {
  globalConfig.set(SECURE_STORAGE_ENABLED_KEY, enabled)
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

export const getStoredAPIToken = async (): Promise<{ token: string | undefined; fromKeychain: boolean }> => {
  const globalConfig = await getGlobalConfigStore()

  if (isSecureStorageEnabled(globalConfig)) {
    const userId = globalConfig.get('userId') as string | undefined
    if (userId) {
      const secureToken = await getTokenFromKeychain(userId)
      if (secureToken) return { token: secureToken, fromKeychain: true }
    }
  }

  const token = await getAPIToken()
  return { token, fromKeychain: false }
}
