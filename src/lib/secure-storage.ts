import { confirm } from '@inquirer/prompts'
import {
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
    `Could not read your Netlify auth token from the OS keychain: ${error.message}
If your keychain is locked or access was denied, unlock it or allow access and try again, or run ${chalk.cyanBright(
      'netlify login --new',
    )}. In scripts, CI or agents, set ${chalk.cyanBright('NETLIFY_AUTH_TOKEN')} instead.`,
  )
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
  log(`The CLI can move it to your OS keychain, which is more secure. Your OS may ask you to allow access.`)
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
      `Could not save your token to the OS keychain: ${write.error.message}
It stays in plaintext and the CLI won't ask again. To retry, unlock your keychain and run ${chalk.cyanBright(
        'netlify login --new',
      )}.`,
    )
    trackStored('legacy', false, true)
    return false
  }
  globalConfig.set(`users.${userId}.auth.token`, undefined)
  log(chalk.green('Auth token moved to the OS keychain.'))
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
    `Could not save your auth token to the OS keychain: ${write.error.message}
It was saved in plaintext at ${getLegacyConfigFilePath()} instead. To retry, unlock your keychain and run ${chalk.cyanBright(
      'netlify login --new',
    )}. To always use plaintext storage and hide this warning, set ${chalk.cyanBright(`${LEGACY_STORAGE_ENV_VAR}=1`)}.`,
  )
  trackStored('legacy', false, true)
  return 'legacy'
}
