import type { GlobalConfigStore } from '@netlify/dev-utils'
import { getProperty, setProperty } from 'dot-prop'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ writeAuthTokenForStorage: vi.fn() }))

vi.mock('../../../src/lib/secure-storage.js', async () => ({
  ...(await vi.importActual('../../../src/lib/secure-storage.js')),
  writeAuthTokenForStorage: mocks.writeAuthTokenForStorage,
}))

import { storeToken } from '../../../src/commands/base-command.js'

const createGlobalConfig = (initial: Record<string, unknown>) => {
  const data: Record<string, unknown> = structuredClone(initial)
  return {
    get: (key: string): unknown => getProperty(data, key),
    set: (key: string, value: unknown) => {
      setProperty(data, key, value)
    },
  } as unknown as GlobalConfigStore
}

const userWithPlaintextToken = {
  userId: 'user-1',
  users: { 'user-1': { id: 'user-1', auth: { token: 'old-plaintext', github: { user: 'gh-user', token: 'gh-tok' } } } },
}

describe('storeToken', () => {
  beforeEach(() => {
    mocks.writeAuthTokenForStorage.mockReset()
  })

  test('clears a pre-existing plaintext token when the new token goes to the keychain', async () => {
    mocks.writeAuthTokenForStorage.mockResolvedValue('keychain')
    const globalConfig = createGlobalConfig(userWithPlaintextToken)

    await storeToken(globalConfig, { userId: 'user-1', accessToken: 'new-token' })

    expect(globalConfig.get('users.user-1.auth.token')).toBeUndefined()
    expect(globalConfig.get('users.user-1.auth.github')).toEqual({ user: 'gh-user', token: 'gh-tok' })
  })

  test('switches the current user before storing, so storage telemetry is attributed to them', async () => {
    let userIdDuringWrite: unknown
    mocks.writeAuthTokenForStorage.mockImplementation(() => {
      userIdDuringWrite = globalConfig.get('userId')
      return Promise.resolve('keychain')
    })
    const globalConfig = createGlobalConfig({ ...userWithPlaintextToken, userId: 'previous-user' })

    await storeToken(globalConfig, { userId: 'user-1', accessToken: 'new-token' })

    expect(userIdDuringWrite).toBe('user-1')
  })

  test('writes the token to the config file when falling back to legacy storage', async () => {
    mocks.writeAuthTokenForStorage.mockResolvedValue('legacy')
    const globalConfig = createGlobalConfig(userWithPlaintextToken)

    await storeToken(globalConfig, { userId: 'user-1', accessToken: 'new-token' })

    expect(globalConfig.get('users.user-1.auth.token')).toBe('new-token')
  })

  describe('keychain copy marker', () => {
    const userWithKeychainToken = {
      userId: 'user-1',
      users: { 'user-1': { id: 'user-1', email: 'one@example.com', auth: {} } },
    }

    test('marks an account whose keychain token is left behind by a plaintext write', async () => {
      mocks.writeAuthTokenForStorage.mockResolvedValue('legacy')
      const globalConfig = createGlobalConfig(userWithKeychainToken)

      await storeToken(globalConfig, { userId: 'user-1', accessToken: 'new-token' })

      expect(globalConfig.get('users.user-1.auth.token')).toBe('new-token')
      expect(globalConfig.get('users.user-1.auth.keychainCopy')).toBe(true)
    })

    test('does not mark an account that only ever had a plaintext token', async () => {
      mocks.writeAuthTokenForStorage.mockResolvedValue('legacy')
      const globalConfig = createGlobalConfig(userWithPlaintextToken)

      await storeToken(globalConfig, { userId: 'user-1', accessToken: 'new-token' })

      expect(globalConfig.get('users.user-1.auth.keychainCopy')).toBeUndefined()
    })

    test('does not mark a new account', async () => {
      mocks.writeAuthTokenForStorage.mockResolvedValue('legacy')
      const globalConfig = createGlobalConfig({})

      await storeToken(globalConfig, { userId: 'user-1', accessToken: 'new-token' })

      expect(globalConfig.get('users.user-1.auth.keychainCopy')).toBeUndefined()
    })

    test('keeps the mark across later plaintext writes', async () => {
      mocks.writeAuthTokenForStorage.mockResolvedValue('legacy')
      const globalConfig = createGlobalConfig({
        userId: 'user-1',
        users: { 'user-1': { id: 'user-1', auth: { token: 'plain', keychainCopy: true } } },
      })

      await storeToken(globalConfig, { userId: 'user-1', accessToken: 'new-token' })

      expect(globalConfig.get('users.user-1.auth.keychainCopy')).toBe(true)
    })

    test('clears the mark once the keychain is written again, since that replaces the old copy', async () => {
      mocks.writeAuthTokenForStorage.mockResolvedValue('keychain')
      const globalConfig = createGlobalConfig({
        userId: 'user-1',
        users: { 'user-1': { id: 'user-1', auth: { token: 'plain', keychainCopy: true } } },
      })

      await storeToken(globalConfig, { userId: 'user-1', accessToken: 'new-token' })

      expect(globalConfig.get('users.user-1.auth.token')).toBeUndefined()
      expect(globalConfig.get('users.user-1.auth.keychainCopy')).toBeUndefined()
    })
  })
})
