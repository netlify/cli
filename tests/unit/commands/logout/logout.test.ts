import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getToken: vi.fn(),
  deleteTokenFromKeychain: vi.fn(),
  output: [] as string[],
  interactive: false,
}))

vi.mock('@netlify/dev-utils', async () => ({
  ...(await vi.importActual('@netlify/dev-utils')),
  deleteTokenFromKeychain: mocks.deleteTokenFromKeychain,
}))

vi.mock('../../../../src/utils/command-helpers.js', async () => ({
  ...(await vi.importActual('../../../../src/utils/command-helpers.js')),
  getToken: mocks.getToken,
  log: (message = '') => {
    mocks.output.push(message)
  },
  warn: (message = '') => {
    mocks.output.push(`Warning: ${message}`)
  },
  exit: (code = 0): never => {
    throw new Error(`exit(${String(code)})`)
  },
}))

vi.mock('../../../../src/utils/telemetry/index.js', () => ({ track: vi.fn() }))

vi.mock('../../../../src/utils/scripted-commands.js', () => ({ isInteractive: () => mocks.interactive }))

type Tree = Record<string, unknown>

const createConfig = (initial: Tree) => {
  const data = structuredClone(initial)
  return {
    data,
    get: (key: string): unknown =>
      key.split('.').reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], data),
    set: (key: string, value: unknown) => {
      const parts = key.split('.')
      const last = parts.at(-1) ?? key
      const parent = parts.slice(0, -1).reduce<Tree>((node, part) => {
        node[part] ??= {}
        return node[part] as Tree
      }, data)
      if (value === undefined) {
        Reflect.deleteProperty(parent, last)
      } else {
        parent[last] = value
      }
    },
  }
}

// The keychain-failure flag is module state, so each run gets a fresh module
const runLogout = async (options: Record<string, unknown>, config: ReturnType<typeof createConfig>) => {
  vi.resetModules()
  const { logout } = await import('../../../../src/commands/logout/logout.js')
  await logout(options, { netlify: { globalConfig: config } } as unknown as Parameters<typeof logout>[1])
}

const output = () => mocks.output.join('\n')

const threeAccounts = () =>
  createConfig({
    userId: 'user-1',
    users: {
      'user-1': { id: 'user-1', email: 'one@example.com', auth: {} },
      'user-2': { id: 'user-2', email: 'two@example.com', auth: { token: 'plain-2' } },
      'user-3': { id: 'user-3', email: 'three@example.com', auth: {} },
    },
  })

beforeEach(() => {
  mocks.output.length = 0
  mocks.interactive = false
  mocks.getToken.mockReset().mockResolvedValue(['tok', 'keychain'])
  mocks.deleteTokenFromKeychain.mockReset().mockResolvedValue({ status: 'deleted' })
})

describe('logout', () => {
  test('keeps every saved token by default so `netlify switch` still works', async () => {
    const config = threeAccounts()

    await runLogout({}, config)

    expect(config.data.userId).toBeNull()
    expect(Object.keys(config.data.users as Tree)).toEqual(['user-1', 'user-2', 'user-3'])
    expect(mocks.deleteTokenFromKeychain).not.toHaveBeenCalled()
  })

  test('warns that a plaintext token is still on disk and how to delete it', async () => {
    mocks.getToken.mockResolvedValue(['plain-1', 'config'])
    const config = createConfig({
      userId: 'user-1',
      users: { 'user-1': { id: 'user-1', auth: { token: 'plain-1' } } },
    })

    await runLogout({}, config)

    expect(output()).toContain('Warning: Your auth token is still stored in plaintext')
    expect(output()).toContain('netlify logout --forget')
  })

  test('mentions that a keychain token is kept and how to delete it', async () => {
    await runLogout({}, threeAccounts())

    expect(output()).not.toContain('Warning')
    expect(output()).toContain('still saved in your keychain')
    expect(output()).toContain('netlify logout --forget')
  })

  test('does not mention a kept token after --forget', async () => {
    await runLogout({ forget: true }, threeAccounts())

    expect(output()).not.toContain('still saved in your keychain')
  })

  describe('--forget', () => {
    test("deletes only the current account's token and lists the accounts that still have one", async () => {
      const config = threeAccounts()

      await runLogout({ forget: true }, config)

      expect(mocks.deleteTokenFromKeychain).toHaveBeenCalledExactlyOnceWith('user-1')
      expect(config.data.userId).toBeNull()
      expect(Object.keys(config.data.users as Tree)).toEqual(['user-2', 'user-3'])
      expect(output()).toContain('Deleted the saved auth token for one@example.com.')
      expect(output()).toContain('2 other accounts on this device still have saved auth tokens')
      expect(output()).toContain('two@example.com')
      expect(output()).toContain('three@example.com')
      expect(output()).toContain('netlify logout --all')
    })

    test('when already logged out, lists the accounts that still have a saved token', async () => {
      mocks.getToken.mockResolvedValue([undefined, 'not found'])
      const config = threeAccounts()
      config.set('userId', null)

      await expect(runLogout({ forget: true }, config)).rejects.toThrow('exit(0)')

      expect(output()).toContain('Already logged out')
      expect(output()).toContain('3 accounts on this device still have saved auth tokens')
      expect(output()).toContain('To delete them, run netlify logout --all')
      expect(mocks.deleteTokenFromKeychain).not.toHaveBeenCalled()
    })

    test('removes a plaintext token without touching the keychain in a non-interactive session', async () => {
      const config = createConfig({
        userId: 'user-1',
        users: { 'user-1': { id: 'user-1', auth: { token: 'plain-1' } } },
      })

      await runLogout({ forget: true }, config)

      expect(config.data.users).toEqual({})
      expect(mocks.deleteTokenFromKeychain).not.toHaveBeenCalled()
      expect(output()).not.toContain('Warning')
    })

    test('also clears any keychain copy of a plaintext token in an interactive session', async () => {
      mocks.interactive = true
      const config = createConfig({
        userId: 'user-1',
        users: { 'user-1': { id: 'user-1', auth: { token: 'plain-1' } } },
      })

      await runLogout({ forget: true }, config)

      expect(mocks.deleteTokenFromKeychain).toHaveBeenCalledExactlyOnceWith('user-1')
      expect(config.data.users).toEqual({})
    })

    test('keeps the account and explains how to retry when its keychain token cannot be deleted', async () => {
      mocks.deleteTokenFromKeychain.mockResolvedValue({ status: 'error', error: new Error('Keychain is locked') })
      const config = threeAccounts()

      await runLogout({ forget: true }, config)

      expect(config.get('users.user-1')).toBeDefined()
      expect(output()).toContain('Keychain is locked')
      expect(output()).toContain('netlify logout --forget')
      expect(output()).not.toContain('Deleted the saved auth token')
    })

    test('does not list the account it failed to forget among the other accounts', async () => {
      mocks.deleteTokenFromKeychain.mockResolvedValue({ status: 'error', error: new Error('Keychain is locked') })
      const config = threeAccounts()

      await runLogout({ forget: true }, config)

      const remainingWarning = mocks.output.find((line) => line.includes('still have saved auth tokens')) ?? ''
      expect(remainingWarning).toContain('2 other accounts')
      expect(remainingWarning).not.toContain('one@example.com')
      expect(remainingWarning).toContain('two@example.com')
      expect(remainingWarning).toContain('three@example.com')
    })

    test('still removes a plaintext token when the keychain is unavailable', async () => {
      mocks.interactive = true
      mocks.deleteTokenFromKeychain.mockResolvedValue({ status: 'error', error: new Error('No keychain') })
      const config = createConfig({
        userId: 'user-1',
        users: { 'user-1': { id: 'user-1', auth: { token: 'plain-1' } } },
      })

      await runLogout({ forget: true }, config)

      expect(config.data.users).toEqual({})
      expect(output()).not.toContain('No keychain')
    })
  })

  describe('--all', () => {
    test('stops calling the keychain after its first failure', async () => {
      mocks.interactive = true
      mocks.deleteTokenFromKeychain.mockResolvedValue({ status: 'error', error: new Error('Timed out') })
      const config = threeAccounts()

      await runLogout({ all: true }, config)

      expect(mocks.deleteTokenFromKeychain).toHaveBeenCalledExactlyOnceWith('user-1')
      expect(Object.keys(config.data.users as Tree)).toEqual(['user-1', 'user-3'])
      expect(output()).toContain('one@example.com from your keychain: Timed out')
      expect(output()).toContain('three@example.com from your keychain: Timed out')
      expect(output()).toContain('Deleted the saved auth token for two@example.com.')
    })

    test('deletes the saved tokens for every account', async () => {
      const config = threeAccounts()

      await runLogout({ all: true }, config)

      expect(mocks.deleteTokenFromKeychain.mock.calls).toEqual([['user-1'], ['user-3']])
      expect(config.data.users).toEqual({})
      expect(config.data.userId).toBeNull()
      expect(output()).toContain('Deleted the saved auth tokens for 3 accounts.')
    })

    test('works when no account is currently logged in', async () => {
      mocks.getToken.mockResolvedValue([undefined, 'not found'])
      const config = threeAccounts()
      config.set('userId', null)

      await runLogout({ all: true }, config)

      expect(config.data.users).toEqual({})
    })

    test('says already logged out when there is nothing to delete', async () => {
      mocks.getToken.mockResolvedValue([undefined, 'not found'])
      const config = createConfig({ userId: null, users: {} })

      await expect(runLogout({ all: true }, config)).rejects.toThrow('exit(0)')
      expect(output()).toContain('Already logged out')
    })
  })
})
