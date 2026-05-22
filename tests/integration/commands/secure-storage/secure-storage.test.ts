import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import execa from 'execa'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { cliPath } from '../../utils/cli-path.js'
import { CONFIRM, NO, handleQuestions } from '../../utils/handle-questions.js'
import { withMockApi } from '../../utils/mock-api.js'
import type { MinimalAccount } from '../../../../src/utils/types.js'

interface StoredConfig {
  telemetryDisabled?: boolean
  cliId?: string
  userId?: string
  users?: Record<string, { id?: string; auth?: { token?: string } }>
  auth?: { keychainMigrationDeclined?: boolean }
}

interface StatusJSON {
  authTokenStorage: { source: string; configPath?: string }
  account: Record<string, unknown>
  siteData: Record<string, unknown>
}

const readConfig = (configDir: string): StoredConfig =>
  JSON.parse(readFileSync(path.join(configDir, 'config.json'), 'utf8')) as StoredConfig

const SERVICE_NAME = 'netlify-cli'

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

const detectKeychainAvailability = async (): Promise<boolean> => {
  const keyring = await import('@napi-rs/keyring').catch(() => null)
  if (!keyring) return false
  try {
    const probeAccount = `netlify-cli-test-probe-${String(Date.now())}`
    const entry = new keyring.Entry(SERVICE_NAME, probeAccount)
    entry.setPassword('ok')
    const value = entry.getPassword()
    entry.deletePassword()
    return value === 'ok'
  } catch {
    return false
  }
}

const cleanupKeychainEntry = async (account: string): Promise<void> => {
  const keyring = await import('@napi-rs/keyring').catch(() => null)
  if (!keyring) return
  try {
    new keyring.Entry(SERVICE_NAME, account).deletePassword()
  } catch {
    // ignore
  }
}

const readKeychainEntry = async (account: string): Promise<string | null> => {
  const keyring = await import('@napi-rs/keyring').catch(() => null)
  if (!keyring) return null
  try {
    return new keyring.Entry(SERVICE_NAME, account).getPassword()
  } catch {
    return null
  }
}

const writeLegacyTokenToConfig = (configDir: string, userId: string, token: string) => {
  mkdirSync(configDir, { recursive: true })
  const config: StoredConfig = {
    telemetryDisabled: true,
    cliId: 'test-cli-id',
    userId,
    users: { [userId]: { id: userId, auth: { token } } },
  }
  writeFileSync(path.join(configDir, 'config.json'), JSON.stringify(config, null, '\t'))
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
  NETLIFY_SITE_ID: 'site_id',
  NETLIFY_API_URL: apiUrl,
  ...extra,
})

beforeEach(() => {
  tmpHome = mkdtempSync(path.join(tmpdir(), 'nf-cli-secure-storage-it-'))
  configDir = path.join(tmpHome, '.config', 'netlify')
})

afterEach(async () => {
  rmSync(tmpHome, { recursive: true, force: true })
  await Promise.all(accountsToCleanup.splice(0).map(cleanupKeychainEntry))
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
      const stdout = (await callCli(
        ['status'],
        { env: isolatedEnv(apiUrl, { NETLIFY_AUTH_TOKEN: 'env-tok' }), extendEnv: false },
      )) as string

      expect(stdout).toContain('Auth token storage')
      expect(stdout).toContain('NETLIFY_AUTH_TOKEN')
    })
  })

  test('reports config source with the config file path when reading from the legacy plaintext config', async () => {
    writeLegacyTokenToConfig(configDir, user.id, 'plain-tok')

    await withMockApi(routes, async ({ apiUrl }) => {
      const json = (await callCli(
        ['status', '--json'],
        { env: isolatedEnv(apiUrl, { NETLIFY_USE_LEGACY_AUTH_STORAGE: '1' }), extendEnv: false },
        true,
      )) as StatusJSON

      expect(json.authTokenStorage.source).toBe('config')
      expect(json.authTokenStorage.configPath).toMatch(/[\\/]netlify[\\/]config\.json$/)
      expect(json.authTokenStorage.configPath?.startsWith(tmpHome)).toBe(true)
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
    writeLegacyTokenToConfig(configDir, user.id, 'plain-tok')

    await withMockApi(routes, async ({ apiUrl }) => {
      const json = (await callCli(
        ['status', '--json'],
        { env: isolatedEnv(apiUrl, { NETLIFY_USE_LEGACY_AUTH_STORAGE: '1' }), extendEnv: false },
        true,
      )) as StatusJSON

      expect(json.authTokenStorage.source).toBe('config')
      const config = readConfig(configDir)
      expect(config.users?.[user.id]?.auth?.token).toBe('plain-tok')
    })
  })
})

describe('migration prompt non-interactive safety', () => {
  test('never prompts when the CLI is invoked with CI=true', async () => {
    writeLegacyTokenToConfig(configDir, user.id, 'plain-tok')

    await withMockApi(routes, async ({ apiUrl }) => {
      const stdout = (await callCli(['status'], {
        env: isolatedEnv(apiUrl, { CI: 'true' }),
        extendEnv: false,
      })) as string

      expect(stdout).not.toContain('Move the token to the keychain')
      const config = readConfig(configDir)
      expect(config.users?.[user.id]?.auth?.token).toBe('plain-tok')
      expect(config.auth?.keychainMigrationDeclined).not.toBe(true)
    })
  })

  test('never prompts when stdin is not a TTY (piped input)', async () => {
    writeLegacyTokenToConfig(configDir, user.id, 'plain-tok')

    await withMockApi(routes, async ({ apiUrl }) => {
      const { stdout } = await execa(cliPath, ['status'], {
        env: isolatedEnv(apiUrl),
        extendEnv: false,
        timeout: 60_000,
        input: '',
      })

      expect(stdout).not.toContain('Move the token to the keychain')
      const config = readConfig(configDir)
      expect(config.users?.[user.id]?.auth?.token).toBe('plain-tok')
    })
  })
})

describe('migration prompt interactive flow', () => {
  test('declining the prompt persists the choice and leaves the legacy token in place', async () => {
    writeLegacyTokenToConfig(configDir, user.id, 'plain-tok')

    await withMockApi(routes, async ({ apiUrl }) => {
      const childProcess = execa(cliPath, ['status'], {
        env: isolatedEnv(apiUrl, { TESTING_PROMPTS: 'true' }),
        extendEnv: false,
        timeout: 60_000,
      })

      handleQuestions(childProcess, [{ question: 'Move the token to the keychain', answer: NO + CONFIRM }])

      await childProcess

      const config = readConfig(configDir)
      expect(config.users?.[user.id]?.auth?.token).toBe('plain-tok')
      expect(config.auth?.keychainMigrationDeclined).toBe(true)
    })

    await withMockApi(routes, async ({ apiUrl }) => {
      const stdout = (await callCli(['status'], {
        env: isolatedEnv(apiUrl, { TESTING_PROMPTS: 'true' }),
        extendEnv: false,
      })) as string

      expect(stdout).not.toContain('Move the token to the keychain')
    })
  })

  test.runIf(keychainReady)(
    'confirming the prompt moves the token to the keychain and removes it from the plaintext config',
    async () => {
      accountsToCleanup.push(user.id)
      writeLegacyTokenToConfig(configDir, user.id, 'plain-tok')

      await withMockApi(routes, async ({ apiUrl }) => {
        const childProcess = execa(cliPath, ['status'], {
          env: isolatedEnv(apiUrl, { TESTING_PROMPTS: 'true' }),
          extendEnv: false,
          timeout: 60_000,
        })

        handleQuestions(childProcess, [{ question: 'Move the token to the keychain', answer: CONFIRM }])

        await childProcess

        expect(await readKeychainEntry(user.id)).toBe('plain-tok')
        const config = readConfig(configDir)
        expect(config.users?.[user.id]?.auth?.token).toBeUndefined()
        expect(config.auth?.keychainMigrationDeclined).not.toBe(true)
      })
    },
  )

  test.runIf(keychainReady)(
    'reports keychain source in status output after the token has been moved to the keychain',
    async () => {
      accountsToCleanup.push(user.id)
      mkdirSync(configDir, { recursive: true })
      const config: StoredConfig = {
        telemetryDisabled: true,
        cliId: 'test-cli-id',
        userId: user.id,
        users: { [user.id]: { id: user.id, auth: {} } },
      }
      writeFileSync(path.join(configDir, 'config.json'), JSON.stringify(config))

      const keyring = await import('@napi-rs/keyring').catch(() => null)
      if (!keyring) throw new Error('keychain reported available but module is missing')
      new keyring.Entry(SERVICE_NAME, user.id).setPassword('keychain-tok')

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
        expect(stdout).toContain('native secure storage')
      })
    },
  )
})

describe('secure-storage command is removed', () => {
  test('`secure-storage:status` no longer exists', async () => {
    await expect(
      callCli(['secure-storage:status'], { env: isolatedEnv('http://unused'), extendEnv: false }),
    ).rejects.toThrow()
  })
})

test('integration tests never touch the real netlify config', () => {
  const realConfig = process.env.HOME ? path.join(process.env.HOME, '.config', 'netlify', 'config.json') : null
  if (!realConfig || !existsSync(realConfig)) return
  const raw = readFileSync(realConfig, 'utf8')
  expect(raw).not.toContain('test-cli-id')
})
