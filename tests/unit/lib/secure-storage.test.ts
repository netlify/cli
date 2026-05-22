import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  entrySetPassword: vi.fn(),
  entryGetPassword: vi.fn(),
  entryDeletePassword: vi.fn(),
  EntryConstructor: vi.fn(),
  globalConfigGet: vi.fn(),
  globalConfigSet: vi.fn(),
  getAPIToken: vi.fn(),
  isInteractive: vi.fn(),
  track: vi.fn(),
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

vi.mock('../../../src/utils/scripted-commands.js', () => ({
  isInteractive: mocks.isInteractive,
}))

vi.mock('../../../src/utils/telemetry/index.js', () => ({
  track: mocks.track,
}))

const importFresh = async () => {
  vi.resetModules()
  return await import('../../../src/lib/secure-storage.js')
}

describe('secure-storage', () => {
  const originalEnv = process.env.NETLIFY_USE_LEGACY_AUTH_STORAGE

  beforeEach(() => {
    mocks.entrySetPassword.mockReset()
    mocks.entryGetPassword.mockReset()
    mocks.entryDeletePassword.mockReset()
    mocks.EntryConstructor.mockReset()
    mocks.globalConfigGet.mockReset()
    mocks.globalConfigSet.mockReset()
    mocks.getAPIToken.mockReset()
    mocks.isInteractive.mockReset()
    mocks.track.mockReset()
    delete process.env.NETLIFY_USE_LEGACY_AUTH_STORAGE
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NETLIFY_USE_LEGACY_AUTH_STORAGE = originalEnv
    } else {
      delete process.env.NETLIFY_USE_LEGACY_AUTH_STORAGE
    }
    vi.clearAllMocks()
  })

  describe('isLegacyAuthStorageForced', () => {
    test('returns true when the env var is set', async () => {
      process.env.NETLIFY_USE_LEGACY_AUTH_STORAGE = '1'
      const { isLegacyAuthStorageForced } = await importFresh()
      expect(isLegacyAuthStorageForced()).toBe(true)
    })

    test('returns false when the env var is empty', async () => {
      process.env.NETLIFY_USE_LEGACY_AUTH_STORAGE = ''
      const { isLegacyAuthStorageForced } = await importFresh()
      expect(isLegacyAuthStorageForced()).toBe(false)
    })

    test('returns false when the env var is unset', async () => {
      const { isLegacyAuthStorageForced } = await importFresh()
      expect(isLegacyAuthStorageForced()).toBe(false)
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
  })

  describe('writeAuthTokenForStorage', () => {
    test('writes to keychain by default', async () => {
      mocks.entrySetPassword.mockReturnValue(undefined)
      const { writeAuthTokenForStorage } = await importFresh()

      const result = await writeAuthTokenForStorage('user-1', 'tok-1')

      expect(result).toEqual({ mode: 'keychain', keychainFailed: false })
      expect(mocks.entrySetPassword).toHaveBeenCalledWith('tok-1')
      expect(mocks.track).toHaveBeenCalledWith(
        'user_authTokenStored',
        expect.objectContaining({ mode: 'keychain', migrated: false }),
      )
    })

    test('falls back to legacy with a flag when keychain fails', async () => {
      mocks.entrySetPassword.mockImplementation(() => {
        throw new Error('AccessDenied')
      })
      const { writeAuthTokenForStorage } = await importFresh()

      const result = await writeAuthTokenForStorage('user-1', 'tok-1')

      expect(result).toEqual({ mode: 'legacy', keychainFailed: true })
      expect(mocks.track).toHaveBeenCalledWith(
        'user_authTokenStored',
        expect.objectContaining({ mode: 'legacy', keychainFailed: true }),
      )
    })

    test('uses legacy when the env var forces it', async () => {
      process.env.NETLIFY_USE_LEGACY_AUTH_STORAGE = '1'
      const { writeAuthTokenForStorage } = await importFresh()

      const result = await writeAuthTokenForStorage('user-1', 'tok-1')

      expect(result).toEqual({ mode: 'legacy', keychainFailed: false })
      expect(mocks.entrySetPassword).not.toHaveBeenCalled()
      expect(mocks.track).toHaveBeenCalledWith(
        'user_authTokenStored',
        expect.objectContaining({ mode: 'legacy', migrated: false }),
      )
    })
  })

  describe('getStoredAPIToken', () => {
    test('returns the keychain token when present', async () => {
      mocks.globalConfigGet.mockImplementation((key: string) => (key === 'userId' ? 'user-1' : undefined))
      mocks.entryGetPassword.mockReturnValue('tok-from-keychain')

      const { getStoredAPIToken } = await importFresh()
      const result = await getStoredAPIToken()

      expect(result).toEqual({ token: 'tok-from-keychain', fromKeychain: true })
      expect(mocks.getAPIToken).not.toHaveBeenCalled()
      expect(mocks.track).toHaveBeenCalledWith('user_authTokenRead', { mode: 'keychain' })
    })

    test('returns undefined when no token is found anywhere', async () => {
      mocks.globalConfigGet.mockImplementation((key: string) => (key === 'userId' ? 'user-1' : undefined))
      mocks.entryGetPassword.mockImplementation(() => {
        throw new Error('NoEntry')
      })
      mocks.getAPIToken.mockResolvedValue(undefined)

      const { getStoredAPIToken } = await importFresh()
      const result = await getStoredAPIToken()

      expect(result).toEqual({ token: undefined, fromKeychain: false })
    })

    test('auto-migrates a legacy token to the keychain in interactive sessions', async () => {
      mocks.globalConfigGet.mockImplementation((key: string) => (key === 'userId' ? 'user-1' : undefined))
      mocks.entryGetPassword.mockImplementation(() => {
        throw new Error('NoEntry')
      })
      mocks.entrySetPassword.mockReturnValue(undefined)
      mocks.getAPIToken.mockResolvedValue('legacy-tok')
      mocks.isInteractive.mockReturnValue(true)

      const { getStoredAPIToken } = await importFresh()
      const result = await getStoredAPIToken()

      expect(result).toEqual({ token: 'legacy-tok', fromKeychain: true })
      expect(mocks.entrySetPassword).toHaveBeenCalledWith('legacy-tok')
      expect(mocks.globalConfigSet).toHaveBeenCalledWith('users.user-1.auth.token', undefined)
      expect(mocks.track).toHaveBeenCalledWith(
        'user_authTokenStored',
        expect.objectContaining({ mode: 'keychain', migrated: true }),
      )
    })

    test('does not attempt migration in non-interactive sessions', async () => {
      mocks.globalConfigGet.mockImplementation((key: string) => (key === 'userId' ? 'user-1' : undefined))
      mocks.entryGetPassword.mockImplementation(() => {
        throw new Error('NoEntry')
      })
      mocks.getAPIToken.mockResolvedValue('legacy-tok')
      mocks.isInteractive.mockReturnValue(false)

      const { getStoredAPIToken } = await importFresh()
      const result = await getStoredAPIToken()

      expect(result).toEqual({ token: 'legacy-tok', fromKeychain: false })
      expect(mocks.entrySetPassword).not.toHaveBeenCalled()
      expect(mocks.globalConfigSet).not.toHaveBeenCalled()
      expect(mocks.track).toHaveBeenCalledWith('user_authTokenRead', { mode: 'legacy' })
    })

    test('returns the legacy token when migration fails and tracks the failure', async () => {
      mocks.globalConfigGet.mockImplementation((key: string) => (key === 'userId' ? 'user-1' : undefined))
      mocks.entryGetPassword.mockImplementation(() => {
        throw new Error('NoEntry')
      })
      mocks.entrySetPassword.mockImplementation(() => {
        throw new Error('AccessDenied')
      })
      mocks.getAPIToken.mockResolvedValue('legacy-tok')
      mocks.isInteractive.mockReturnValue(true)

      const { getStoredAPIToken } = await importFresh()
      const result = await getStoredAPIToken()

      expect(result).toEqual({ token: 'legacy-tok', fromKeychain: false })
      expect(mocks.globalConfigSet).not.toHaveBeenCalled()
      expect(mocks.track).toHaveBeenCalledWith(
        'user_authTokenStored',
        expect.objectContaining({ mode: 'legacy', keychainFailed: true }),
      )
      expect(mocks.track).toHaveBeenCalledWith('user_authTokenRead', { mode: 'legacy' })
    })

    test('skips keychain entirely when legacy mode is forced', async () => {
      process.env.NETLIFY_USE_LEGACY_AUTH_STORAGE = '1'
      mocks.globalConfigGet.mockImplementation((key: string) => (key === 'userId' ? 'user-1' : undefined))
      mocks.getAPIToken.mockResolvedValue('legacy-tok')

      const { getStoredAPIToken } = await importFresh()
      const result = await getStoredAPIToken()

      expect(result).toEqual({ token: 'legacy-tok', fromKeychain: false })
      expect(mocks.entryGetPassword).not.toHaveBeenCalled()
      expect(mocks.track).toHaveBeenCalledWith('user_authTokenRead', { mode: 'legacy' })
    })
  })
})
