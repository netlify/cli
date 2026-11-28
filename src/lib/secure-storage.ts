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
let keychainDeleteError: Error | undefined

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

export const getAccountsWithPlaintextTokens = (globalConfig: ConfigReader): string[] =>
  Object.entries(getStoredUsers(globalConfig))
    .filter(([, user]) => Boolean(user?.auth?.token))
    .map(([id]) => id)

export const warnAboutPlaintextAccounts = (
  globalConfig: ConfigReader,
  currentUserId: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): void => {
  if (isLegacyAuthStorageForced(env)) return
  const userIds = getAccountsWithPlaintextTokens(globalConfig)
  if (userIds.length === 0) return

  const accountList = userIds
    .map((userId) => {
      const label = describeSavedAccount(globalConfig, userId)
      return `  - ${userId === currentUserId ? `${label} (current)` : label}`
    })
    .join('\n')
  const includesCurrent = currentUserId != null && userIds.includes(currentUserId)
  const subject = `${userIds.length.toString()} ${includesCurrent ? '' : 'other '}account${
    userIds.length === 1 ? ' on this device stores its' : 's on this device store their'
  }`
  const cmd = chalk.cyanBright
  const selectStep = includesCurrent
    ? `run ${cmd('netlify switch')} to select its account (not needed for the current one)`
    : `run ${cmd('netlify switch')} to select its account`

  warn(
    `${subject} auth token in plaintext:
${accountList}
To move a token to your keychain, ${selectStep}, then run ${cmd('netlify status')} and accept the prompt.
If you aren't asked (because you declined before, or the session isn't interactive), run ${cmd(
      'netlify logout --forget',
    )} and then ${cmd('netlify login')} instead.`,
  )
}

export const skipKeychainMigrationPrompt = (): void => {
  skipMigrationThisSession = true
}

const canUseKeychainInteractively = (env: NodeJS.ProcessEnv): boolean =>
  isInteractive() || env.TESTING_PROMPTS === 'true'

// Each keychain call can wait up to 30s on an unanswered OS dialog, so one failure skips the rest of this run
const deleteFromKeychainUnlessFailedBefore = async (userId: string): Promise<Error | undefined> => {
  if (keychainDeleteError) return keychainDeleteError
  const result = await deleteTokenFromKeychain(userId)
  if (result.status === 'error') keychainDeleteError = result.error
  return keychainDeleteError
}

// A keychain error only matters when the keychain was the sole copy: plaintext-only accounts often
// live on machines with no keychain at all, and would otherwise never be forgettable there
export const forgetStoredAccount = async (
  globalConfig: ConfigStore,
  userId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<Error | undefined> => {
  const hadPlaintextToken = Boolean(getStoredUsers(globalConfig)[userId]?.auth?.token)
  globalConfig.set(`users.${userId}.auth.token`, undefined)

  if (!hadPlaintextToken || canUseKeychainInteractively(env)) {
    const keychainError = await deleteFromKeychainUnlessFailedBefore(userId)
    if (keychainError && !hadPlaintextToken) return keychainError
  }

  globalConfig.set(`users.${userId}`, undefined)
  return undefined
}

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
  warnAboutPlaintextAccounts(globalConfig, userId)
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
