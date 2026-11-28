import type { StoredAPIToken } from '@netlify/dev-utils'
import { beforeEach, describe, expect, test, vi } from 'vitest'

interface MockState {
  config: Record<string, unknown>
  stored: StoredAPIToken
  interactive: boolean
  logSuppressed: boolean
}

const mocks = vi.hoisted(() => {
  const state: MockState = {
    config: {},
    stored: { source: 'none' },
    interactive: false,
    logSuppressed: false,
  }
  type Tree = Record<string, unknown>
  const getPath = (key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], state.config)
  const setPath = (key: string, value: unknown) => {
    const parts = key.split('.')
    const last = parts.at(-1) ?? key
    const parent = parts.slice(0, -1).reduce<Tree>((node, part) => {
      node[part] ??= {}
      return node[part] as Tree
    }, state.config)
    if (value === undefined) {
      Reflect.deleteProperty(parent, last)
    } else {
      parent[last] = value
    }
  }
  return Object.assign(state, {
    getPath,
    setPath,
    confirm: vi.fn(),
    storeTokenInKeychain: vi.fn(),
    warn: vi.fn(),
  })
})

vi.mock('@netlify/dev-utils', async () => ({
  ...(await vi.importActual('@netlify/dev-utils')),
  getGlobalConfigStore: () =>
    Promise.resolve({
      get: mocks.getPath,
      set: mocks.setPath,
    }),
  readStoredAPIToken: () => Promise.resolve(mocks.stored),
  storeTokenInKeychain: mocks.storeTokenInKeychain,
}))

vi.mock('@inquirer/prompts', () => ({ confirm: mocks.confirm }))

vi.mock('../../../src/utils/scripted-commands.js', () => ({ isInteractive: () => mocks.interactive }))

vi.mock('../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../src/utils/command-helpers.js')),
  isLogSuppressed: () => mocks.logSuppressed,
  log: vi.fn(),
  warn: mocks.warn,
}))

vi.mock('../../../src/utils/telemetry/index.js', () => ({ track: vi.fn(), reportError: vi.fn() }))

// Prompt-once and warn-once flags are module state, so each test gets a fresh module
const loadSecureStorage = async () => {
  vi.resetModules()
  return import('../../../src/lib/secure-storage.js')
}

beforeEach(() => {
  mocks.config = { userId: 'user-1', users: { 'user-1': { id: 'user-1', auth: { token: 'plain-tok' } } } }
  mocks.stored = { source: 'none' }
  mocks.interactive = false
  mocks.logSuppressed = false
  mocks.confirm.mockReset()
  mocks.storeTokenInKeychain.mockReset().mockResolvedValue({ status: 'stored' })
  mocks.warn.mockReset()
})

describe('getStoredAPIToken', () => {
  test('returns a keychain token', async () => {
    mocks.stored = { source: 'keychain', token: 'kc-tok' }
    const { getStoredAPIToken } = await loadSecureStorage()

    await expect(getStoredAPIToken({})).resolves.toEqual({ token: 'kc-tok', fromKeychain: true })
  })

  test('warns once, with next steps, when the keychain cannot be read', async () => {
    mocks.stored = { source: 'none', keychainError: new Error('User interaction is not allowed.') }
    const { getStoredAPIToken } = await loadSecureStorage()

    await expect(getStoredAPIToken({})).resolves.toEqual({ token: undefined, fromKeychain: false })
    await getStoredAPIToken({})

    expect(mocks.warn).toHaveBeenCalledOnce()
    const [message] = mocks.warn.mock.calls[0] as [string]
    expect(message).toContain('User interaction is not allowed.')
    expect(message).toContain('netlify login --new')
    expect(message).toContain('NETLIFY_AUTH_TOKEN')
  })

  test('does not warn when the user is simply not logged in', async () => {
    const { getStoredAPIToken } = await loadSecureStorage()

    await expect(getStoredAPIToken({})).resolves.toEqual({ token: undefined, fromKeychain: false })
    expect(mocks.warn).not.toHaveBeenCalled()
  })
})

describe('plaintext token migration', () => {
  beforeEach(() => {
    mocks.stored = { source: 'config', token: 'plain-tok' }
  })

  test('never prompts in a non-interactive session', async () => {
    const { getStoredAPIToken } = await loadSecureStorage()

    await expect(getStoredAPIToken({})).resolves.toEqual({ token: 'plain-tok', fromKeychain: false })
    expect(mocks.confirm).not.toHaveBeenCalled()
  })

  test('never prompts when legacy storage is forced', async () => {
    mocks.interactive = true
    const { getStoredAPIToken } = await loadSecureStorage()

    await getStoredAPIToken({ NETLIFY_USE_LEGACY_AUTH_STORAGE: '1' })
    expect(mocks.confirm).not.toHaveBeenCalled()
  })

  test('moves the token to the keychain and removes the plaintext copy when confirmed', async () => {
    mocks.interactive = true
    mocks.setPath('users.user-1.auth.keychainCopy', true)
    mocks.confirm.mockResolvedValue(true)
    const { getStoredAPIToken } = await loadSecureStorage()

    await expect(getStoredAPIToken({})).resolves.toEqual({ token: 'plain-tok', fromKeychain: true })
    expect(mocks.storeTokenInKeychain).toHaveBeenCalledWith('user-1', 'plain-tok')
    expect(mocks.getPath('users.user-1.auth.token')).toBeUndefined()
    expect(mocks.getPath('users.user-1.auth.keychainCopy')).toBeUndefined()
  })

  test('after moving the token, warns only about the other accounts that still store their token in plaintext', async () => {
    mocks.interactive = true
    mocks.confirm.mockResolvedValue(true)
    mocks.config.users = {
      'user-1': { id: 'user-1', email: 'one@example.com', auth: { token: 'plain-tok' } },
      'user-2': { id: 'user-2', name: 'Two', email: 'two@example.com', auth: { token: 'plain-tok-2' } },
      'user-3': { id: 'user-3', email: 'three@example.com', auth: {} },
    }
    const { getStoredAPIToken } = await loadSecureStorage()

    await getStoredAPIToken({})
    expect(mocks.warn).toHaveBeenCalledTimes(1)
    const [message] = mocks.warn.mock.calls[0] as [string]
    expect(message).toContain('1 other account on this device stores its auth token in plaintext')
    expect(message).toContain('Two (two@example.com)')
    expect(message).not.toContain('one@example.com')
    expect(message).not.toContain('three@example.com')
    expect(message).not.toContain('(current)')
    expect(message).toContain('netlify switch')
  })

  test('does not warn about other accounts when there are none with a plaintext token', async () => {
    mocks.interactive = true
    mocks.confirm.mockResolvedValue(true)
    const { getStoredAPIToken } = await loadSecureStorage()

    await getStoredAPIToken({})
    expect(mocks.warn).not.toHaveBeenCalled()
  })

  test('stops asking after a failed keychain write and explains how to retry', async () => {
    mocks.interactive = true
    mocks.confirm.mockResolvedValue(true)
    mocks.storeTokenInKeychain.mockResolvedValue({ status: 'error', error: new Error('Keychain is locked') })
    const { getStoredAPIToken } = await loadSecureStorage()

    await expect(getStoredAPIToken({})).resolves.toEqual({ token: 'plain-tok', fromKeychain: false })
    expect(mocks.getPath('users.user-1.auth.token')).toBe('plain-tok')
    expect(mocks.getPath('users.user-1.auth.skipKeychainMigration')).toBe(true)
    const [message] = mocks.warn.mock.calls[0] as [string]
    expect(message).toContain('Keychain is locked')
    expect(message).toContain('netlify login --new')
  })

  test('stops asking once declined', async () => {
    mocks.interactive = true
    mocks.confirm.mockResolvedValue(false)
    const { getStoredAPIToken } = await loadSecureStorage()

    await getStoredAPIToken({})
    expect(mocks.getPath('users.user-1.auth.skipKeychainMigration')).toBe(true)
    expect(mocks.storeTokenInKeychain).not.toHaveBeenCalled()
  })

  test('never prompts when output is suppressed by --json or --silent', async () => {
    mocks.interactive = true
    mocks.logSuppressed = true
    const { getStoredAPIToken } = await loadSecureStorage()

    await getStoredAPIToken({})
    expect(mocks.confirm).not.toHaveBeenCalled()
  })

  test('never prompts once skipped for this session', async () => {
    mocks.interactive = true
    const { getStoredAPIToken, skipKeychainMigrationPrompt } = await loadSecureStorage()

    skipKeychainMigrationPrompt()
    await expect(getStoredAPIToken({})).resolves.toEqual({ token: 'plain-tok', fromKeychain: false })
    expect(mocks.confirm).not.toHaveBeenCalled()
  })

  test('lets Ctrl+C at the prompt abort the command', async () => {
    mocks.interactive = true
    mocks.confirm.mockRejectedValue(
      Object.assign(new Error('User force closed the prompt'), { name: 'ExitPromptError' }),
    )
    const { getStoredAPIToken } = await loadSecureStorage()

    await expect(getStoredAPIToken({})).rejects.toMatchObject({ name: 'ExitPromptError' })
  })
})

describe('writeAuthTokenForStorage', () => {
  test('uses plaintext without touching the keychain in a non-interactive session', async () => {
    const { writeAuthTokenForStorage } = await loadSecureStorage()

    await expect(writeAuthTokenForStorage('user-1', 'tok', {})).resolves.toBe('legacy')
    expect(mocks.storeTokenInKeychain).not.toHaveBeenCalled()
  })

  test('uses the keychain in an interactive session', async () => {
    mocks.interactive = true
    const { writeAuthTokenForStorage } = await loadSecureStorage()

    await expect(writeAuthTokenForStorage('user-1', 'tok', {})).resolves.toBe('keychain')
    expect(mocks.warn).not.toHaveBeenCalled()
  })

  test('falls back to plaintext with an actionable warning when the keychain write fails', async () => {
    mocks.interactive = true
    mocks.storeTokenInKeychain.mockResolvedValue({ status: 'error', error: new Error('Keychain is locked') })
    const { writeAuthTokenForStorage } = await loadSecureStorage()

    await expect(writeAuthTokenForStorage('user-1', 'tok', {})).resolves.toBe('legacy')
    const [message] = mocks.warn.mock.calls[0] as [string]
    expect(message).toContain('Keychain is locked')
    expect(message).toContain('netlify login --new')
    expect(message).toContain('NETLIFY_USE_LEGACY_AUTH_STORAGE=1')
  })
})

describe('warnAboutPlaintextAccounts', () => {
  const configWith = (users: Record<string, unknown>) => ({
    get: (key: string) => (key === 'users' ? users : undefined),
  })

  test('marks the current account when its own token is also in plaintext', async () => {
    const { warnAboutPlaintextAccounts } = await loadSecureStorage()

    warnAboutPlaintextAccounts(
      configWith({
        'user-1': { id: 'user-1', email: 'one@example.com', auth: { token: 'plain-1' } },
        'user-2': { id: 'user-2', email: 'two@example.com', auth: { token: 'plain-2' } },
      }),
      'user-1',
      {},
    )

    const [message] = mocks.warn.mock.calls[0] as [string]
    expect(message).toContain('2 accounts on this device store their auth token in plaintext')
    expect(message).toContain('one@example.com (current)')
    expect(message).toContain('two@example.com')
    expect(message).toContain('not needed for the current one')
  })

  test('says "other" when only other accounts are in plaintext', async () => {
    const { warnAboutPlaintextAccounts } = await loadSecureStorage()

    warnAboutPlaintextAccounts(
      configWith({
        'user-1': { id: 'user-1', auth: {} },
        'user-2': { id: 'user-2', email: 'two@example.com', auth: { token: 'plain-2' } },
      }),
      'user-1',
      {},
    )

    const [message] = mocks.warn.mock.calls[0] as [string]
    expect(message).toContain('1 other account on this device stores its auth token in plaintext')
    expect(message).not.toContain('(current)')
    expect(message).not.toContain('not needed for the current one')
  })

  test('explains what to do when the migration prompt does not appear', async () => {
    const { warnAboutPlaintextAccounts } = await loadSecureStorage()

    warnAboutPlaintextAccounts(configWith({ 'user-2': { id: 'user-2', auth: { token: 'plain-2' } } }), 'user-1', {})

    const [message] = mocks.warn.mock.calls[0] as [string]
    expect(message).toContain("If you aren't asked")
    expect(message).toContain('netlify logout --forget')
    expect(message).toContain('netlify login')
  })

  test('asks for an interactive terminal, since a non-interactive login stores the token in plaintext again', async () => {
    const { warnAboutPlaintextAccounts } = await loadSecureStorage()

    warnAboutPlaintextAccounts(configWith({ 'user-2': { id: 'user-2', auth: { token: 'plain-2' } } }), 'user-1', {})

    const [message] = mocks.warn.mock.calls[0] as [string]
    expect(message).toContain('open an interactive terminal')
    expect(message).toContain('netlify login')
    expect(message).toContain('in that terminal instead')
  })

  test('stays quiet when plaintext storage is forced, since those tokens cannot be moved', async () => {
    const { warnAboutPlaintextAccounts } = await loadSecureStorage()

    warnAboutPlaintextAccounts(configWith({ 'user-2': { id: 'user-2', auth: { token: 'plain-2' } } }), 'user-1', {
      NETLIFY_USE_LEGACY_AUTH_STORAGE: '1',
    })
    expect(mocks.warn).not.toHaveBeenCalled()
  })
})
