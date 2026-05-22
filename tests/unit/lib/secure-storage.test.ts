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
  inquirerPrompt: vi.fn(),
  log: vi.fn(),
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

vi.mock('inquirer', () => ({
  default: { prompt: mocks.inquirerPrompt },
}))

vi.mock('../../../src/utils/command-helpers.js', async () => {
  const actual = await vi.importActual<typeof import('../../../src/utils/command-helpers.js')>(
    '../../../src/utils/command-helpers.js',
  )
  return { ...actual, log: mocks.log }
})

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
    mocks.inquirerPrompt.mockReset()
    mocks.log.mockReset()
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

    test('returns false when the env var is empty or unset', async () => {
      process.env.NETLIFY_USE_LEGACY_AUTH_STORAGE = ''
      const { isLegacyAuthStorageForced } = await importFresh()
      expect(isLegacyAuthStorageForced()).toBe(false)
    })
  })

  describe('storeTokenInKeychain / getTokenFromKeychain / deleteTokenFromKeychain', () => {
    test('round-trips through the keyring', async () => {
      mocks.entrySetPassword.mockReturnValue(undefined)
      mocks.entryGetPassword.mockReturnValue('tok-abc')
      mocks.entryDeletePassword.mockReturnValue(true)
      const { storeTokenInKeychain, getTokenFromKeychain, deleteTokenFromKeychain } = await importFresh()

      await expect(storeTokenInKeychain('user-1', 'tok-abc')).resolves.toBe(true)
      await expect(getTokenFromKeychain('user-1')).resolves.toBe('tok-abc')
      await expect(deleteTokenFromKeychain('user-1')).resolves.toBe(true)
      expect(mocks.EntryConstructor).toHaveBeenCalledWith('netlify-cli', 'user-1')
    })

    test('all functions tolerate keyring throws', async () => {
      mocks.entrySetPassword.mockImplementation(() => {
        throw new Error('AccessDenied')
      })
      mocks.entryGetPassword.mockImplementation(() => {
        throw new Error('NoEntry')
      })
      mocks.entryDeletePassword.mockImplementation(() => {
        throw new Error('NoEntry')
      })
      const { storeTokenInKeychain, getTokenFromKeychain, deleteTokenFromKeychain } = await importFresh()

      await expect(storeTokenInKeychain('user-1', 'tok')).resolves.toBe(false)
      await expect(getTokenFromKeychain('user-1')).resolves.toBeNull()
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
    })
  })

  describe('getStoredAPIToken', () => {
    const setupLegacyOnly = (legacyToken: string | undefined) => {
      mocks.globalConfigGet.mockImplementation((key: string) => {
        if (key === 'userId') return 'user-1'
        if (key === 'auth.keychainMigrationDeclined') return undefined
        return undefined
      })
      mocks.entryGetPassword.mockImplementation(() => {
        throw new Error('NoEntry')
      })
      mocks.getAPIToken.mockResolvedValue(legacyToken)
    }

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
      setupLegacyOnly(undefined)
      const { getStoredAPIToken } = await importFresh()
      const result = await getStoredAPIToken()
      expect(result).toEqual({ token: undefined, fromKeychain: false })
    })

    test('prompts before migration and migrates on confirm', async () => {
      setupLegacyOnly('legacy-tok')
      mocks.isInteractive.mockReturnValue(true)
      mocks.entrySetPassword.mockReturnValue(undefined)
      mocks.inquirerPrompt.mockResolvedValue({ confirm: true })

      const { getStoredAPIToken } = await importFresh()
      const result = await getStoredAPIToken()

      expect(mocks.inquirerPrompt).toHaveBeenCalledTimes(1)
      const promptedQuestion = mocks.inquirerPrompt.mock.calls[0]?.[0] as { message: string }[]
      expect(promptedQuestion[0]?.message).toMatch(/keychain/i)
      expect(result).toEqual({ token: 'legacy-tok', fromKeychain: true })
      expect(mocks.entrySetPassword).toHaveBeenCalledWith('legacy-tok')
      expect(mocks.globalConfigSet).toHaveBeenCalledWith('users.user-1.auth.token', undefined)
      expect(mocks.track).toHaveBeenCalledWith(
        'user_authTokenStored',
        expect.objectContaining({ mode: 'keychain', migrated: true }),
      )
    })

    test('persists the decline so future runs do not re-prompt', async () => {
      setupLegacyOnly('legacy-tok')
      mocks.isInteractive.mockReturnValue(true)
      mocks.inquirerPrompt.mockResolvedValue({ confirm: false })

      const { getStoredAPIToken } = await importFresh()
      const result = await getStoredAPIToken()

      expect(result).toEqual({ token: 'legacy-tok', fromKeychain: false })
      expect(mocks.globalConfigSet).toHaveBeenCalledWith('auth.keychainMigrationDeclined', true)
      expect(mocks.entrySetPassword).not.toHaveBeenCalled()
      expect(mocks.track).toHaveBeenCalledWith('user_authTokenMigrationDeclined', {})
    })

    test('skips the prompt when the user previously declined', async () => {
      mocks.globalConfigGet.mockImplementation((key: string) => {
        if (key === 'userId') return 'user-1'
        if (key === 'auth.keychainMigrationDeclined') return true
        return undefined
      })
      mocks.entryGetPassword.mockImplementation(() => {
        throw new Error('NoEntry')
      })
      mocks.getAPIToken.mockResolvedValue('legacy-tok')
      mocks.isInteractive.mockReturnValue(true)

      const { getStoredAPIToken } = await importFresh()
      const result = await getStoredAPIToken()

      expect(mocks.inquirerPrompt).not.toHaveBeenCalled()
      expect(result).toEqual({ token: 'legacy-tok', fromKeychain: false })
      expect(mocks.track).toHaveBeenCalledWith('user_authTokenRead', { mode: 'legacy' })
    })

    test('does not prompt in non-interactive sessions', async () => {
      setupLegacyOnly('legacy-tok')
      mocks.isInteractive.mockReturnValue(false)

      const { getStoredAPIToken } = await importFresh()
      const result = await getStoredAPIToken()

      expect(mocks.inquirerPrompt).not.toHaveBeenCalled()
      expect(result).toEqual({ token: 'legacy-tok', fromKeychain: false })
    })

    test('falls back to legacy when migration fails after the user confirms', async () => {
      setupLegacyOnly('legacy-tok')
      mocks.isInteractive.mockReturnValue(true)
      mocks.entrySetPassword.mockImplementation(() => {
        throw new Error('AccessDenied')
      })
      mocks.inquirerPrompt.mockResolvedValue({ confirm: true })

      const { getStoredAPIToken } = await importFresh()
      const result = await getStoredAPIToken()

      expect(result).toEqual({ token: 'legacy-tok', fromKeychain: false })
      expect(mocks.globalConfigSet).not.toHaveBeenCalledWith('users.user-1.auth.token', undefined)
      expect(mocks.track).toHaveBeenCalledWith(
        'user_authTokenStored',
        expect.objectContaining({ mode: 'legacy', keychainFailed: true }),
      )
    })

    test('skips keychain entirely when legacy mode is forced', async () => {
      process.env.NETLIFY_USE_LEGACY_AUTH_STORAGE = '1'
      mocks.globalConfigGet.mockImplementation((key: string) => (key === 'userId' ? 'user-1' : undefined))
      mocks.getAPIToken.mockResolvedValue('legacy-tok')

      const { getStoredAPIToken } = await importFresh()
      const result = await getStoredAPIToken()

      expect(result).toEqual({ token: 'legacy-tok', fromKeychain: false })
      expect(mocks.entryGetPassword).not.toHaveBeenCalled()
      expect(mocks.inquirerPrompt).not.toHaveBeenCalled()
    })
  })

  describe('getLegacyConfigFilePath', () => {
    test('returns a path ending with config.json', async () => {
      const { getLegacyConfigFilePath } = await importFresh()
      expect(getLegacyConfigFilePath()).toMatch(/config\.json$/)
    })
  })
})
