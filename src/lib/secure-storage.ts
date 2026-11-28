import { confirm } from '@inquirer/prompts'
import {
  deleteTokenFromKeychain,
  getGlobalConfigStore,
  getLegacyConfigFilePath,
  isLegacyAuthStorageForced,
  LEGACY_STORAGE_ENV_VAR,
  readStoredAPIToken,
  storeTokenInKeychain,
} from '@netlify/dev-utils'

import { chalk, isLogSuppressed, log, warn } from '../utils/command-helpers.js'
import { isInteractive } from '../utils/scripted-commands.js'
import { reportError, track } from '../utils/telemetry/index.js'

export type TokenStorageMode = 'keychain' | 'legacy'

let skipMigrationThisSession = false
let keychainReadFailureWarned = false

const skipMigrationKey = (userId: string) => `users.${userId}.auth.skipKeychainMigration`

const trackStored = (mode: TokenStorageMode, migrated: boolean, keychainFailed = false): void => {
  void track('user_authTokenStored', { mode, migrated, ...(keychainFailed ? { keychainFailed: true } : {}) })
}

const warnKeychainReadFailed = (error: Error): void => {
  if (keychainReadFailureWarned) return
  keychainReadFailureWarned = true
  warn(
    `Could not read your Netlify auth token from your keychain: ${error.message}
If your keychain is locked or access was denied, unlock it or allow access and try again, or run ${chalk.cyanBright(
      'netlify login --new',
    )}. In scripts, CI or agents, set ${chalk.cyanBright('NETLIFY_AUTH_TOKEN')} instead.`,
  )
}

interface StoredUser {
  name?: string
  email?: string
  auth?: { token?: string }
}

interface ConfigReader {
  get: (key: string) => unknown
}

interface ConfigStore extends ConfigReader {
  set: (key: string, value: unknown) => void
}

const getStoredUsers = (globalConfig: ConfigReader): Record<string, StoredUser | undefined> =>
  (globalConfig.get('users') ?? {}) as Record<string, StoredUser | undefined>

export const describeSavedAccount = (globalConfig: ConfigReader, userId: string): string => {
  const { name, email } = getStoredUsers(globalConfig)[userId] ?? {}
  return name && email ? `${name} (${email})` : (email ?? name ?? userId)
}

export const getSavedAccountIds = (globalConfig: ConfigReader): string[] => Object.keys(getStoredUsers(globalConfig))

export const formatAccountList = (globalConfig: ConfigReader, userIds: string[]): string =>
  userIds.map((userId) => `  - ${describeSavedAccount(globalConfig, userId)}`).join('\n')

export const getOtherAccountsWithPlaintextTokens = (
  globalConfig: ConfigReader,
  currentUserId: string | undefined,
): string[] =>
  Object.entries(getStoredUsers(globalConfig))
    .filter(([id, user]) => id !== currentUserId && Boolean(user?.auth?.token))
    .map(([id]) => id)

export const warnAboutOtherPlaintextAccounts = (
  globalConfig: ConfigReader,
  currentUserId: string | undefined,
): void => {
  const userIds = getOtherAccountsWithPlaintextTokens(globalConfig, currentUserId)
  if (userIds.length === 0) return
  const noun =
    userIds.length === 1 ? 'account on this device still stores its' : 'accounts on this device still store their'
  warn(
    `${userIds.length.toString()} other ${noun} auth token in plaintext:
${formatAccountList(globalConfig, userIds)}
Only the current account's token is moved to the keychain. To move the others, run ${chalk.cyanBright(
      'netlify switch',
    )} to select each account, then run ${chalk.cyanBright('netlify status')} and accept the prompt.`,
  )
}

// A keychain error only matters when the keychain was the sole copy: plaintext-only accounts often
// live on machines with no keychain at all, and would otherwise never be forgettable there
export const forgetStoredAccount = async (globalConfig: ConfigStore, userId: string): Promise<Error | undefined> => {
  const hadPlaintextToken = Boolean(getStoredUsers(globalConfig)[userId]?.auth?.token)
  globalConfig.set(`users.${userId}.auth.token`, undefined)

  const keychainDelete = await deleteTokenFromKeychain(userId)
  if (keychainDelete.status === 'error' && !hadPlaintextToken) return keychainDelete.error

  globalConfig.set(`users.${userId}`, undefined)
  return undefined
}

export const skipKeychainMigrationPrompt = (): void => {
  skipMigrationThisSession = true
}

const canUseKeychainInteractively = (env: NodeJS.ProcessEnv): boolean =>
  isInteractive() || env.TESTING_PROMPTS === 'true'

const isPromptExit = (error: unknown): boolean => error instanceof Error && error.name === 'ExitPromptError'

const attemptMigration = async (token: string, env: NodeJS.ProcessEnv): Promise<boolean> => {
  if (
    isLegacyAuthStorageForced(env) ||
    !canUseKeychainInteractively(env) ||
    skipMigrationThisSession ||
    // --json and --silent hide the prompt's context lines but not the question itself
    isLogSuppressed()
  )
    return false
  const globalConfig = await getGlobalConfigStore()
  const userId = globalConfig.get('userId') as string | undefined
  if (userId == null || globalConfig.get(skipMigrationKey(userId)) === true) return false

  skipMigrationThisSession = true

  log()
  log(`Your Netlify auth token is stored in plaintext at ${chalk.cyanBright(getLegacyConfigFilePath())}.`)
  log(
    `The CLI can move it to your operating system's keychain, which is more secure. You may be asked to allow access.`,
  )
  log()
  let confirmed: boolean
  try {
    confirmed = await confirm({ message: 'Move the token to the keychain now?', default: true })
  } catch (error) {
    if (isPromptExit(error)) throw error
    void reportError(error, { severity: 'error' })
    return false
  }

  if (!confirmed) {
    globalConfig.set(skipMigrationKey(userId), true)
    log(
      chalk.dim(
        `The CLI won't ask again. To move it later, run ${chalk.cyanBright('netlify login --new')} in a terminal.`,
      ),
    )
    void track('user_authTokenMigrationDeclined', {})
    return false
  }

  const write = await storeTokenInKeychain(userId, token)
  if (write.status === 'error') {
    globalConfig.set(skipMigrationKey(userId), true)
    warn(
      `Could not save your token to your keychain: ${write.error.message}
It stays in plaintext and the CLI won't ask again. To retry, unlock your keychain and run ${chalk.cyanBright(
        'netlify login --new',
      )}.`,
    )
    trackStored('legacy', false, true)
    return false
  }
  globalConfig.set(`users.${userId}.auth.token`, undefined)
  log(chalk.green('Auth token moved to your keychain.'))
  warnAboutOtherPlaintextAccounts(globalConfig, userId)
  trackStored('keychain', true)
  return true
}

export const getStoredAPIToken = async (
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ token: string | undefined; fromKeychain: boolean }> => {
  const stored = await readStoredAPIToken(env)
  switch (stored.source) {
    case 'keychain':
      return { token: stored.token, fromKeychain: true }
    case 'config':
      return { token: stored.token, fromKeychain: await attemptMigration(stored.token, env) }
    case 'none':
      if (stored.keychainError) warnKeychainReadFailed(stored.keychainError)
      return { token: undefined, fromKeychain: false }
  }
}

// Non-interactive logins never touch the keychain, so they can't trigger an OS dialog nobody answers
export const writeAuthTokenForStorage = async (
  userId: string,
  accessToken: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<TokenStorageMode> => {
  if (isLegacyAuthStorageForced(env) || !canUseKeychainInteractively(env)) {
    trackStored('legacy', false)
    return 'legacy'
  }

  const write = await storeTokenInKeychain(userId, accessToken)
  if (write.status === 'stored') {
    trackStored('keychain', false)
    return 'keychain'
  }

  warn(
    `Could not save your auth token to your keychain: ${write.error.message}
It was saved in plaintext at ${getLegacyConfigFilePath()} instead. To retry, unlock your keychain and run ${chalk.cyanBright(
      'netlify login --new',
    )}. To always use plaintext storage and hide this warning, set ${chalk.cyanBright(`${LEGACY_STORAGE_ENV_VAR}=1`)}.`,
  )
  trackStored('legacy', false, true)
  return 'legacy'
}
