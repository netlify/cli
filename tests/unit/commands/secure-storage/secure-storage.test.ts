import { beforeEach, describe, expect, test, vi } from 'vitest'

const { logMessages, mocks } = vi.hoisted(() => ({
  logMessages: [] as string[],
  mocks: {
    isKeychainAvailable: vi.fn(),
    isLegacyAuthStorageForced: vi.fn(),
    getTokenFromKeychain: vi.fn(),
  },
}))

vi.mock('../../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../../src/utils/command-helpers.js')),
  log: (...args: string[]) => {
    logMessages.push(args.join(' '))
  },
}))

vi.mock('../../../../src/lib/secure-storage.js', async () => {
  const actual = await vi.importActual<typeof import('../../../../src/lib/secure-storage.js')>(
    '../../../../src/lib/secure-storage.js',
  )
  return {
    ...actual,
    isKeychainAvailable: mocks.isKeychainAvailable,
    isLegacyAuthStorageForced: mocks.isLegacyAuthStorageForced,
    getTokenFromKeychain: mocks.getTokenFromKeychain,
  }
})

import { secureStorageStatus } from '../../../../src/commands/secure-storage/secure-storage.js'

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
  const set = vi.fn()
  const command = { netlify: { globalConfig: { get, set } } } as unknown as Command
  return { command, state }
}

describe('secureStorageStatus', () => {
  beforeEach(() => {
    logMessages.length = 0
    vi.clearAllMocks()
  })

  test('reports keychain mode when the token is in the keychain', async () => {
    mocks.isKeychainAvailable.mockResolvedValue(true)
    mocks.isLegacyAuthStorageForced.mockReturnValue(false)
    mocks.getTokenFromKeychain.mockResolvedValue('tok-from-keychain')
    const { command } = createCommand({ userId: 'user-1', users: { 'user-1': { id: 'user-1', auth: {} } } })

    await secureStorageStatus({}, command)

    const out = logMessages.join('\n')
    expect(out).toContain('Keychain available')
    expect(out).toContain('OS keychain')
  })

  test('reports legacy mode when the token is in the config file', async () => {
    mocks.isKeychainAvailable.mockResolvedValue(true)
    mocks.isLegacyAuthStorageForced.mockReturnValue(false)
    mocks.getTokenFromKeychain.mockResolvedValue(null)
    const { command } = createCommand({
      userId: 'user-1',
      users: { 'user-1': { id: 'user-1', auth: { token: 'plain-tok' } } },
    })

    await secureStorageStatus({}, command)

    const out = logMessages.join('\n')
    expect(out).toContain('plaintext config file')
    expect(out).toContain('migrated to the keychain automatically')
  })

  test('reports legacy mode being forced via the env var', async () => {
    mocks.isKeychainAvailable.mockResolvedValue(true)
    mocks.isLegacyAuthStorageForced.mockReturnValue(true)
    mocks.getTokenFromKeychain.mockResolvedValue(null)
    const { command } = createCommand({
      userId: 'user-1',
      users: { 'user-1': { id: 'user-1', auth: { token: 'plain-tok' } } },
    })

    await secureStorageStatus({}, command)

    const out = logMessages.join('\n')
    expect(out).toContain('NETLIFY_USE_LEGACY_AUTH_STORAGE')
    expect(out).toContain('plaintext config file')
    expect(out).not.toContain('migrated to the keychain automatically')
  })

  test('reports not logged in when there is no userId', async () => {
    mocks.isKeychainAvailable.mockResolvedValue(true)
    mocks.isLegacyAuthStorageForced.mockReturnValue(false)
    mocks.getTokenFromKeychain.mockResolvedValue(null)
    const { command } = createCommand()

    await secureStorageStatus({}, command)

    expect(logMessages.join('\n')).toContain('Not logged in')
  })
})
