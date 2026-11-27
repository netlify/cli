import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import execa from 'execa'
import { getLegacyConfigFilePath } from '@netlify/dev-utils'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { callCli } from './utils/call-cli.js'
import { cliPath } from './utils/cli-path.js'
import { CONFIRM, NO, handleQuestions } from './utils/handle-questions.js'
import { withMockApi } from './utils/mock-api.js'
import type { MinimalAccount } from '../../src/utils/types.js'

interface StoredConfig {
  telemetryDisabled?: boolean
  cliId?: string
  userId?: string
  users?: Record<string, { id?: string; auth?: { token?: string; skipKeychainMigration?: boolean } }>
}

interface StatusJSON {
  authTokenStorage: { source: string; configPath?: string }
  account: Record<string, unknown>
  siteData: Record<string, unknown>
}

const readConfig = async (configDir: string): Promise<StoredConfig> =>
  JSON.parse(await readFile(path.join(configDir, 'config.json'), 'utf8')) as StoredConfig

const siteInfo = {
  account_slug: 'test-account',
  id: 'site_id',
  name: 'site-name',
  admin_url: 'https://app.netlify.com/projects/test-site/overview',
  url: 'https://test-site.netlify.app/',
}
const user = { full_name: 'Test User', email: 'test@netlify.com', id: 'user-id' }
const accounts: MinimalAccount[] = [
  {
    id: 'user-id',
    name: user.full_name,
    slug: siteInfo.account_slug,
    default: true,
    team_logo_url: null,
    on_pro_trial: false,
    organization_id: null,
    type_name: 'placeholder',
    type_slug: 'placeholder',
    members_count: 1,
  },
]
const routes = [
  { path: 'sites/site_id', response: siteInfo },
  { path: 'sites/site_id/service-instances', response: [] },
  { path: 'accounts', response: accounts },
  { path: 'user', response: user },
]

// macOS resolves the default keychain via $HOME, so each test gets a throwaway login keychain
// under its temp home. Other platforms can't be redirected; entries written there are deleted afterwards.
const usesIsolatedKeychain = process.platform === 'darwin'
const execFileAsync = promisify(execFile)

const createIsolatedKeychain = async (home: string): Promise<void> => {
  await mkdir(path.join(home, 'Library', 'Keychains'), { recursive: true })
  // HOME is overridden for `security` too, or it would add the keychain to the real search list
  await execFileAsync(
    'security',
    ['create-keychain', '-p', '', path.join(home, 'Library', 'Keychains', 'login.keychain-db')],
    {
      env: { ...process.env, HOME: home },
    },
  )
}

const DEV_UTILS_URL = import.meta.resolve('@netlify/dev-utils')

// Constant source: inputs arrive via argv so no value is ever spliced into code
const KEYCHAIN_SCRIPT = `
const [moduleUrl, operation, account, value] = process.argv.slice(1)
const k = await import(moduleUrl)
if (operation === 'store') {
  const result = await k.storeTokenInKeychain(account, value)
  if (result.status === 'error') throw result.error
} else if (operation === 'read') {
  process.stdout.write(JSON.stringify(await k.getTokenFromKeychain(account)))
} else {
  await k.deleteTokenFromKeychain(account)
}
`

// Keychain ops run in a child process so they hit the same keychain as the CLI under test. Items
// are created by `node` (not `security`) so the CLI can read them without an access dialog.
const runKeychain = async (home: string, args: string[]): Promise<string> => {
  const { stdout } = await execFileAsync(
    process.execPath,
    ['--input-type=module', '-e', KEYCHAIN_SCRIPT, DEV_UTILS_URL, ...args],
    { env: usesIsolatedKeychain ? { ...process.env, HOME: home } : process.env },
  )
  return stdout
}

const writeKeychainEntry = async (home: string, account: string, value: string): Promise<void> => {
  await runKeychain(home, ['store', account, value])
}

const readKeychainEntry = async (home: string, account: string): Promise<string | null> =>
  JSON.parse(await runKeychain(home, ['read', account])) as string | null

const deleteKeychainEntry = async (home: string, account: string): Promise<void> => {
  await runKeychain(home, ['delete', account])
}

const detectKeychainAvailability = async (): Promise<boolean> => {
  const home = await mkdtemp(path.join(tmpdir(), 'nf-cli-auth-token-storage-probe-'))
  const account = `netlify-cli-test-probe-${String(Date.now())}`
  try {
    if (usesIsolatedKeychain) await createIsolatedKeychain(home)
    await writeKeychainEntry(home, account, 'ok')
    const value = await readKeychainEntry(home, account)
    await deleteKeychainEntry(home, account)
    return value === 'ok'
  } catch {
    return false
  } finally {
    await rm(home, { recursive: true, force: true })
  }
}

// Mirrors env-paths('netlify', { suffix: '' }) for the platform the subprocess will run on
const getConfigDirForHome = (home: string): string => {
  if (process.platform === 'darwin') return path.join(home, 'Library', 'Preferences', 'netlify')
  if (process.platform === 'win32') return path.join(home, 'AppData', 'Roaming', 'netlify', 'Config')
  return path.join(home, '.config', 'netlify')
}

const writeLegacyTokenToConfig = async (configDir: string, userId: string, token: string) => {
  await mkdir(configDir, { recursive: true })
  const config: StoredConfig = {
    telemetryDisabled: true,
    cliId: 'test-cli-id',
    userId,
    users: { [userId]: { id: userId, auth: { token } } },
  }
  await writeFile(path.join(configDir, 'config.json'), JSON.stringify(config, null, '\t'))
}

let tmpHome: string
let configDir: string
const accountsToCleanup: string[] = []

const isolatedEnv = (apiUrl: string, extra: Record<string, string | undefined> = {}) => ({
  HOME: tmpHome,
  USERPROFILE: tmpHome,
  XDG_CONFIG_HOME: path.join(tmpHome, '.config'),
  APPDATA: path.join(tmpHome, 'AppData', 'Roaming'),
  PATH: process.env.PATH ?? '',
  // Linux reaches Secret Service over the session bus; share it so the CLI sees the same keychain
  DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS,
  XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR,
  NETLIFY_SITE_ID: 'site_id',
  NETLIFY_API_URL: apiUrl,
  ...extra,
})

beforeEach(async () => {
  tmpHome = await mkdtemp(path.join(tmpdir(), 'nf-cli-auth-token-storage-'))
  configDir = getConfigDirForHome(tmpHome)
  if (usesIsolatedKeychain) await createIsolatedKeychain(tmpHome)
})

afterEach(async () => {
  await Promise.all(accountsToCleanup.splice(0).map((account) => deleteKeychainEntry(tmpHome, account)))
  await rm(tmpHome, { recursive: true, force: true })
})

const keychainReady = await detectKeychainAvailability()

describe('netlify status auth token storage', () => {
  test('reports env source in JSON when NETLIFY_AUTH_TOKEN is set', async () => {
    await withMockApi(routes, async ({ apiUrl }) => {
      const json = (await callCli(
        ['status', '--json'],
        { env: isolatedEnv(apiUrl, { NETLIFY_AUTH_TOKEN: 'env-tok' }), extendEnv: false },
        true,
      )) as StatusJSON

      expect(json.authTokenStorage).toEqual({ source: 'env' })
      expect(json.account.Email).toBe('test@netlify.com')
      expect(json.account['Auth token storage']).toBeUndefined()
    })
  })

  test('reports env source in human output with a friendly label', async () => {
    await withMockApi(routes, async ({ apiUrl }) => {
      const stdout = (await callCli(['status'], {
        env: isolatedEnv(apiUrl, { NETLIFY_AUTH_TOKEN: 'env-tok' }),
        extendEnv: false,
      })) as string

      expect(stdout).toContain('Auth token storage')
      expect(stdout).toContain('NETLIFY_AUTH_TOKEN')
    })
  })

  test('reports config source with the config file path when reading from the legacy plaintext config', async () => {
    await writeLegacyTokenToConfig(configDir, user.id, 'plain-tok')

    await withMockApi(routes, async ({ apiUrl }) => {
      const json = (await callCli(
        ['status', '--json'],
        { env: isolatedEnv(apiUrl, { NETLIFY_USE_LEGACY_AUTH_STORAGE: '1' }), extendEnv: false },
        true,
      )) as StatusJSON

      expect(json.authTokenStorage.source).toBe('config')
      expect(json.authTokenStorage.configPath).toBe(path.join(configDir, 'config.json'))
    })
  })

  test('reports flag source when --auth is used', async () => {
    await withMockApi(routes, async ({ apiUrl }) => {
      const json = (await callCli(
        ['status', '--json', '--auth=flag-tok'],
        { env: isolatedEnv(apiUrl), extendEnv: false },
        true,
      )) as StatusJSON

      expect(json.authTokenStorage).toEqual({ source: 'flag' })
    })
  })
})

describe('NETLIFY_USE_LEGACY_AUTH_STORAGE env var', () => {
  test('forces the CLI to read from the legacy config and skip the keychain entirely', async () => {
    await writeLegacyTokenToConfig(configDir, user.id, 'plain-tok')

    await withMockApi(routes, async ({ apiUrl }) => {
      const json = (await callCli(
        ['status', '--json'],
        { env: isolatedEnv(apiUrl, { NETLIFY_USE_LEGACY_AUTH_STORAGE: '1' }), extendEnv: false },
        true,
      )) as StatusJSON

      expect(json.authTokenStorage.source).toBe('config')
      const config = await readConfig(configDir)
      expect(config.users?.[user.id]?.auth?.token).toBe('plain-tok')
    })
  })
})

test('never prompts when run non-interactively', async () => {
  await writeLegacyTokenToConfig(configDir, user.id, 'plain-tok')

  await withMockApi(routes, async ({ apiUrl }) => {
    const stdout = (await callCli(['status'], { env: isolatedEnv(apiUrl), extendEnv: false })) as string

    expect(stdout).not.toContain('Move the token to the keychain')
    const config = await readConfig(configDir)
    expect(config.users?.[user.id]?.auth?.token).toBe('plain-tok')
    expect(config.users?.[user.id]?.auth?.skipKeychainMigration).not.toBe(true)
  })
})

describe('migration prompt interactive flow', () => {
  test('declining the prompt persists the choice and leaves the legacy token in place', async () => {
    await writeLegacyTokenToConfig(configDir, user.id, 'plain-tok')

    await withMockApi(routes, async ({ apiUrl }) => {
      const childProcess = execa(cliPath, ['status'], {
        env: isolatedEnv(apiUrl, { TESTING_PROMPTS: 'true' }),
        extendEnv: false,
        timeout: 60_000,
      })

      handleQuestions(childProcess, [{ question: 'Move the token to the keychain', answer: NO + CONFIRM }])

      await childProcess

      const config = await readConfig(configDir)
      expect(config.users?.[user.id]?.auth?.token).toBe('plain-tok')
      expect(config.users?.[user.id]?.auth?.skipKeychainMigration).toBe(true)
    })

    await withMockApi(routes, async ({ apiUrl }) => {
      const stdout = (await callCli(['status'], {
        env: isolatedEnv(apiUrl, { TESTING_PROMPTS: 'true' }),
        extendEnv: false,
      })) as string

      expect(stdout).not.toContain('Move the token to the keychain')
    })
  })

  test('does not offer to migrate a token that `logout` is discarding', async () => {
    await writeLegacyTokenToConfig(configDir, user.id, 'plain-tok')

    await withMockApi(routes, async ({ apiUrl }) => {
      const { stdout } = await execa(cliPath, ['logout'], {
        env: isolatedEnv(apiUrl, { TESTING_PROMPTS: 'true' }),
        extendEnv: false,
        timeout: 60_000,
        input: '',
      })

      expect(stdout).not.toContain('Move the token to the keychain')
      expect(stdout).toContain('Logging you out')
      expect((await readConfig(configDir)).userId).toBeNull()
    })
  })

  test.runIf(keychainReady)(
    'confirming the prompt moves the token to the keychain and removes it from the plaintext config',
    async () => {
      accountsToCleanup.push(user.id)
      await writeLegacyTokenToConfig(configDir, user.id, 'plain-tok')

      await withMockApi(routes, async ({ apiUrl }) => {
        const childProcess = execa(cliPath, ['status'], {
          env: isolatedEnv(apiUrl, { TESTING_PROMPTS: 'true' }),
          extendEnv: false,
          timeout: 60_000,
        })

        handleQuestions(childProcess, [{ question: 'Move the token to the keychain', answer: CONFIRM }])

        await childProcess

        expect(await readKeychainEntry(tmpHome, user.id)).toBe('plain-tok')
        const config = await readConfig(configDir)
        expect(config.users?.[user.id]?.auth?.token).toBeUndefined()
        expect(config.users?.[user.id]?.auth?.skipKeychainMigration).not.toBe(true)
      })
    },
  )

  test.runIf(keychainReady)(
    'reports keychain source in status output after the token has been moved to the keychain',
    async () => {
      accountsToCleanup.push(user.id)
      await mkdir(configDir, { recursive: true })
      const config: StoredConfig = {
        telemetryDisabled: true,
        cliId: 'test-cli-id',
        userId: user.id,
        users: { [user.id]: { id: user.id, auth: {} } },
      }
      await writeFile(path.join(configDir, 'config.json'), JSON.stringify(config))

      await writeKeychainEntry(tmpHome, user.id, 'keychain-tok')

      await withMockApi(routes, async ({ apiUrl }) => {
        const json = (await callCli(
          ['status', '--json'],
          { env: isolatedEnv(apiUrl), extendEnv: false },
          true,
        )) as StatusJSON

        expect(json.authTokenStorage).toEqual({ source: 'keychain' })

        const stdout = (await callCli(['status'], {
          env: isolatedEnv(apiUrl),
          extendEnv: false,
        })) as string
        expect(stdout).toContain("operating system's keychain")
      })
    },
  )
})

test('integration tests never touch the real netlify config', async () => {
  const raw = await readFile(getLegacyConfigFilePath(), 'utf8').catch(() => '')
  expect(raw).not.toContain('test-cli-id')
})
