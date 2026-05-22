import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  entrySetPassword: vi.fn(),
  entryGetPassword: vi.fn(),
  entryDeletePassword: vi.fn(),
  EntryConstructor: vi.fn(),
  globalConfigGet: vi.fn(),
  globalConfigSet: vi.fn(),
  getAPIToken: vi.fn(),
}))

vi.mock('@napi-rs/keyring', () => {
  class Entry {
    constructor(service: string, account: string) {
      mocks.EntryConstructor(service, account)
    }
    setPassword(password: string): void {
      mocks.entrySetPassword(password)
    }
    getPassword(): string | null {
      return mocks.entryGetPassword() as string | null
    }
    deletePassword(): boolean {
      return mocks.entryDeletePassword() as boolean
    }
  }
  return { Entry }
})

vi.mock('@netlify/dev-utils', () => ({
  getAPIToken: mocks.getAPIToken,
  getGlobalConfigStore: vi.fn().mockResolvedValue({
    get: mocks.globalConfigGet,
    set: mocks.globalConfigSet,
  }),
}))

const importFresh = async () => {
  vi.resetModules()
  return await import('../../../src/lib/secure-storage.js')
}

describe('secure-storage', () => {
  beforeEach(() => {
    mocks.entrySetPassword.mockReset()
    mocks.entryGetPassword.mockReset()
    mocks.entryDeletePassword.mockReset()
    mocks.EntryConstructor.mockReset()
    mocks.globalConfigGet.mockReset()
    mocks.globalConfigSet.mockReset()
    mocks.getAPIToken.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('isSecureStorageEnabled', () => {
    test('returns true when flag is set', async () => {
      const { isSecureStorageEnabled } = await importFresh()
      const globalConfig = { get: vi.fn().mockReturnValue(true), set: vi.fn() } as never
      expect(isSecureStorageEnabled(globalConfig)).toBe(true)
    })

    test('returns false when flag is not set', async () => {
      const { isSecureStorageEnabled } = await importFresh()
      const globalConfig = { get: vi.fn().mockReturnValue(undefined), set: vi.fn() } as never
      expect(isSecureStorageEnabled(globalConfig)).toBe(false)
    })
  })

  describe('setSecureStorageEnabledFlag', () => {
    test('writes the flag to the global config', async () => {
      const { setSecureStorageEnabledFlag } = await importFresh()
      const set = vi.fn()
      setSecureStorageEnabledFlag({ get: vi.fn(), set } as never, true)
      expect(set).toHaveBeenCalledWith('secureStorage.enabled', true)
    })
  })

  describe('storeTokenInKeychain', () => {
    test('writes the token under the netlify-cli service and user id', async () => {
      mocks.entrySetPassword.mockReturnValue(undefined)
      const { storeTokenInKeychain } = await importFresh()

      const result = await storeTokenInKeychain('user-1', 'tok-abc')

      expect(result).toBe(true)
      expect(mocks.EntryConstructor).toHaveBeenCalledWith('netlify-cli', 'user-1')
      expect(mocks.entrySetPassword).toHaveBeenCalledWith('tok-abc')
    })

    test('returns false when the keychain throws', async () => {
      mocks.entrySetPassword.mockImplementation(() => {
        throw new Error('AccessDenied')
      })
      const { storeTokenInKeychain } = await importFresh()
      await expect(storeTokenInKeychain('user-1', 'tok-abc')).resolves.toBe(false)
    })
  })

  describe('getTokenFromKeychain', () => {
    test('returns the stored token', async () => {
      mocks.entryGetPassword.mockReturnValue('tok-from-keychain')
      const { getTokenFromKeychain } = await importFresh()
      await expect(getTokenFromKeychain('user-1')).resolves.toBe('tok-from-keychain')
    })

    test('returns null when the keychain throws', async () => {
      mocks.entryGetPassword.mockImplementation(() => {
        throw new Error('NoEntry')
      })
      const { getTokenFromKeychain } = await importFresh()
      await expect(getTokenFromKeychain('user-1')).resolves.toBeNull()
    })
  })

  describe('deleteTokenFromKeychain', () => {
    test('returns the keychain result on success', async () => {
      mocks.entryDeletePassword.mockReturnValue(true)
      const { deleteTokenFromKeychain } = await importFresh()
      await expect(deleteTokenFromKeychain('user-1')).resolves.toBe(true)
    })

    test('returns false when the keychain throws', async () => {
      mocks.entryDeletePassword.mockImplementation(() => {
        throw new Error('NoEntry')
      })
      const { deleteTokenFromKeychain } = await importFresh()
      await expect(deleteTokenFromKeychain('user-1')).resolves.toBe(false)
    })
  })

  describe('isKeychainAvailable', () => {
    test('returns true when a round-trip succeeds', async () => {
      mocks.entrySetPassword.mockReturnValue(undefined)
      mocks.entryGetPassword.mockReturnValue('ok')
      mocks.entryDeletePassword.mockReturnValue(true)
      const { isKeychainAvailable } = await importFresh()
      await expect(isKeychainAvailable()).resolves.toBe(true)
    })

    test('returns false when the set call throws', async () => {
      mocks.entrySetPassword.mockImplementation(() => {
        throw new Error('AccessDenied')
      })
      const { isKeychainAvailable } = await importFresh()
      await expect(isKeychainAvailable()).resolves.toBe(false)
    })

    test('returns false when the round-trip returns a different value', async () => {
      mocks.entrySetPassword.mockReturnValue(undefined)
      mocks.entryGetPassword.mockReturnValue('something else')
      mocks.entryDeletePassword.mockReturnValue(true)
      const { isKeychainAvailable } = await importFresh()
      await expect(isKeychainAvailable()).resolves.toBe(false)
    })
  })

  describe('getStoredAPIToken', () => {
    test('returns the keychain token when secure storage is enabled and a token is present', async () => {
      mocks.globalConfigGet.mockImplementation((key: string) => {
        if (key === 'secureStorage.enabled') return true
        if (key === 'userId') return 'user-1'
        return undefined
      })
      mocks.entryGetPassword.mockReturnValue('tok-from-keychain')

      const { getStoredAPIToken } = await importFresh()
      const result = await getStoredAPIToken()

      expect(result).toEqual({ token: 'tok-from-keychain', fromKeychain: true })
      expect(mocks.getAPIToken).not.toHaveBeenCalled()
    })

    test('falls back to the legacy plaintext token when secure storage is enabled but the keychain has no entry', async () => {
      mocks.globalConfigGet.mockImplementation((key: string) => {
        if (key === 'secureStorage.enabled') return true
        if (key === 'userId') return 'user-1'
        return undefined
      })
      mocks.entryGetPassword.mockImplementation(() => {
        throw new Error('NoEntry')
      })
      mocks.getAPIToken.mockResolvedValue('legacy-tok')

      const { getStoredAPIToken } = await importFresh()
      const result = await getStoredAPIToken()

      expect(result).toEqual({ token: 'legacy-tok', fromKeychain: false })
    })

    test('uses the legacy plaintext token when secure storage is disabled', async () => {
      mocks.globalConfigGet.mockReturnValue(undefined)
      mocks.getAPIToken.mockResolvedValue('legacy-tok')

      const { getStoredAPIToken } = await importFresh()
      const result = await getStoredAPIToken()

      expect(result).toEqual({ token: 'legacy-tok', fromKeychain: false })
      expect(mocks.entryGetPassword).not.toHaveBeenCalled()
    })
  })
})
