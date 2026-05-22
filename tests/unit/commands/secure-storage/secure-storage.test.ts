import { beforeEach, describe, expect, test, vi } from 'vitest'

const { logMessages, mocks } = vi.hoisted(() => ({
  logMessages: [] as string[],
  mocks: {
    isKeychainAvailable: vi.fn(),
    storeTokenInKeychain: vi.fn(),
    getTokenFromKeychain: vi.fn(),
    deleteTokenFromKeychain: vi.fn(),
  },
}))

vi.mock('../../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../../src/utils/command-helpers.js')),
  log: (...args: string[]) => {
    logMessages.push(args.join(' '))
  },
  logAndThrowError: (message: unknown) => {
    throw message instanceof Error ? message : new Error(String(message))
  },
}))

vi.mock('../../../../src/lib/secure-storage.js', async () => {
  const actual = await vi.importActual<typeof import('../../../../src/lib/secure-storage.js')>(
    '../../../../src/lib/secure-storage.js',
  )
  return {
    ...actual,
    isKeychainAvailable: mocks.isKeychainAvailable,
    storeTokenInKeychain: mocks.storeTokenInKeychain,
    getTokenFromKeychain: mocks.getTokenFromKeychain,
    deleteTokenFromKeychain: mocks.deleteTokenFromKeychain,
  }
})

import {
  secureStorageDisable,
  secureStorageEnable,
  secureStorageStatus,
} from '../../../../src/commands/secure-storage/secure-storage.js'

type Command = Parameters<typeof secureStorageStatus>[1]

const createCommand = (initialState: Record<string, unknown> = {}) => {
  const state: Record<string, unknown> = { ...initialState }
  const get = vi.fn((key: string) => {
    if (key in state) return state[key]
    const parts = key.split('.')
    let cursor: unknown = state
    for (const part of parts) {
      if (cursor && typeof cursor === 'object' && part in (cursor as Record<string, unknown>)) {
        cursor = (cursor as Record<string, unknown>)[part]
      } else {
        return undefined
      }
    }
    return cursor
  })
  const set = vi.fn((key: string, value: unknown) => {
    const parts = key.split('.')
    if (parts.length === 1) {
      state[key] = value
      return
    }
    let cursor: Record<string, unknown> = state
    for (let i = 0; i < parts.length - 1; i += 1) {
      const part = parts[i]
      if (typeof cursor[part] !== 'object' || cursor[part] == null) {
        cursor[part] = {}
      }
      cursor = cursor[part] as Record<string, unknown>
    }
    cursor[parts[parts.length - 1]] = value
  })
  const command = {
    netlify: { globalConfig: { get, set } },
  } as unknown as Command
  return { command, state, get, set }
}

describe('secure-storage commands', () => {
  beforeEach(() => {
    logMessages.length = 0
    vi.clearAllMocks()
  })

  describe('secureStorageStatus', () => {
    test('reports enabled and keychain available', async () => {
      mocks.isKeychainAvailable.mockResolvedValue(true)
      const { command } = createCommand({ secureStorage: { enabled: true } })

      await secureStorageStatus({}, command)

      const out = logMessages.join('\n')
      expect(out).toContain('Secure storage:')
      expect(out).toContain('enabled')
      expect(out).toContain('OS keychain available:')
      expect(out).toContain('yes')
    })

    test('warns when enabled but keychain is unreachable', async () => {
      mocks.isKeychainAvailable.mockResolvedValue(false)
      const { command } = createCommand({ secureStorage: { enabled: true } })

      await secureStorageStatus({}, command)

      const out = logMessages.join('\n')
      expect(out).toContain('Warning')
      expect(out).toContain('not reachable')
    })

    test('reports disabled by default', async () => {
      mocks.isKeychainAvailable.mockResolvedValue(true)
      const { command } = createCommand()

      await secureStorageStatus({}, command)

      expect(logMessages.join('\n')).toContain('disabled')
    })
  })

  describe('secureStorageEnable', () => {
    test('no-ops when already enabled', async () => {
      const { command, set } = createCommand({ secureStorage: { enabled: true } })

      await secureStorageEnable({}, command)

      expect(set).not.toHaveBeenCalled()
      expect(logMessages.join('\n')).toContain('already enabled')
    })

    test('throws when keychain is not available', async () => {
      mocks.isKeychainAvailable.mockResolvedValue(false)
      const { command } = createCommand()

      await expect(secureStorageEnable({}, command)).rejects.toThrow(/keychain is not reachable/)
    })

    test('migrates existing tokens into the keychain and clears them from the config', async () => {
      mocks.isKeychainAvailable.mockResolvedValue(true)
      mocks.storeTokenInKeychain.mockResolvedValue(true)
      const { command, set, state } = createCommand({
        users: {
          'user-1': { id: 'user-1', email: 'alice@example.com', auth: { token: 'tok-1' } },
          'user-2': { id: 'user-2', email: 'bob@example.com', auth: { token: 'tok-2' } },
          'user-3': { id: 'user-3', email: 'charlie@example.com', auth: {} },
        },
      })

      await secureStorageEnable({}, command)

      expect(mocks.storeTokenInKeychain).toHaveBeenCalledWith('user-1', 'tok-1')
      expect(mocks.storeTokenInKeychain).toHaveBeenCalledWith('user-2', 'tok-2')
      expect(mocks.storeTokenInKeychain).not.toHaveBeenCalledWith('user-3', expect.anything())
      expect(set).toHaveBeenCalledWith('users.user-1.auth.token', undefined)
      expect(set).toHaveBeenCalledWith('users.user-2.auth.token', undefined)
      expect(set).toHaveBeenCalledWith('secureStorage.enabled', true)
      expect(state.secureStorage).toEqual({ enabled: true })
      const out = logMessages.join('\n')
      expect(out).toContain('Secure storage enabled')
      expect(out).toContain('alice@example.com')
      expect(out).toContain('bob@example.com')
    })

    test('reports failures and keeps tokens in config when keychain write fails', async () => {
      mocks.isKeychainAvailable.mockResolvedValue(true)
      mocks.storeTokenInKeychain.mockResolvedValue(false)
      const { command, set } = createCommand({
        users: { 'user-1': { id: 'user-1', email: 'alice@example.com', auth: { token: 'tok-1' } } },
      })

      await secureStorageEnable({}, command)

      expect(set).not.toHaveBeenCalledWith('users.user-1.auth.token', undefined)
      expect(set).toHaveBeenCalledWith('secureStorage.enabled', true)
      expect(logMessages.join('\n')).toContain('Could not migrate')
    })
  })

  describe('secureStorageDisable', () => {
    test('no-ops when already disabled', async () => {
      const { command, set } = createCommand()

      await secureStorageDisable({}, command)

      expect(set).not.toHaveBeenCalled()
      expect(logMessages.join('\n')).toContain('already disabled')
    })

    test('moves keychain tokens back to plaintext config and clears the flag', async () => {
      mocks.getTokenFromKeychain.mockImplementation((id: string) => {
        if (id === 'user-1') return Promise.resolve('tok-1')
        if (id === 'user-2') return Promise.resolve(null)
        return Promise.resolve(null)
      })
      mocks.deleteTokenFromKeychain.mockResolvedValue(true)
      const { command, set } = createCommand({
        secureStorage: { enabled: true },
        users: {
          'user-1': { id: 'user-1', email: 'alice@example.com', auth: {} },
          'user-2': { id: 'user-2', email: 'bob@example.com', auth: {} },
        },
      })

      await secureStorageDisable({}, command)

      expect(set).toHaveBeenCalledWith('users.user-1.auth.token', 'tok-1')
      expect(set).not.toHaveBeenCalledWith('users.user-2.auth.token', expect.anything())
      expect(set).toHaveBeenCalledWith('secureStorage.enabled', false)
      expect(mocks.deleteTokenFromKeychain).toHaveBeenCalledWith('user-1')
      const out = logMessages.join('\n')
      expect(out).toContain('Secure storage disabled')
      expect(out).toContain('alice@example.com')
    })
  })
})
