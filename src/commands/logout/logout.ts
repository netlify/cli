import { getLegacyConfigFilePath } from '@netlify/dev-utils'
import { OptionValues } from 'commander'

import {
  describeSavedAccount,
  forgetStoredAccount,
  formatAccountList,
  getSavedAccountIds,
} from '../../lib/secure-storage.js'
import { chalk, exit, getToken, log, warn } from '../../utils/command-helpers.js'
import { track } from '../../utils/telemetry/index.js'
import type { TokenLocation } from '../../utils/types.js'
import BaseCommand from '../base-command.js'

type GlobalConfig = BaseCommand['netlify']['globalConfig']

const forgetAccounts = async (globalConfig: GlobalConfig, userIds: string[], retryHint: string): Promise<void> => {
  const forgotten: string[] = []
  // One at a time, so the OS shows at most one keychain dialog at once
  for (const userId of userIds) {
    const account = describeSavedAccount(globalConfig, userId)
    const error = await forgetStoredAccount(globalConfig, userId)
    if (error) {
      warn(`Could not delete the auth token for ${account} from your keychain: ${error.message}
Unlock your keychain or allow access, then ${retryHint}.`)
    } else {
      forgotten.push(account)
    }
  }
  if (forgotten.length === 1) log(`Deleted the saved auth token for ${forgotten[0]}.`)
  if (forgotten.length > 1) log(`Deleted the saved auth tokens for ${forgotten.length.toString()} accounts.`)
}

const warnAboutRemainingAccounts = (globalConfig: GlobalConfig, handledUserId?: string): void => {
  const remaining = getSavedAccountIds(globalConfig).filter((userId) => userId !== handledUserId)
  if (remaining.length === 0) return
  const isOne = remaining.length === 1
  const other = handledUserId ? 'other ' : ''
  const asWell = handledUserId ? ' as well' : ''
  warn(
    `${remaining.length.toString()} ${other}account${isOne ? ' on this device still has a' : 's on this device still have'} saved auth token${isOne ? '' : 's'}:
${formatAccountList(globalConfig, remaining)}
To delete ${isOne ? 'it' : 'them'}${asWell}, run ${chalk.cyanBright('netlify logout --all')}.`,
  )
}

// Stored tokens are kept by default so `netlify switch` can return to the account without logging in again
const explainKeptToken = (globalConfig: GlobalConfig, userId: string, location: TokenLocation): void => {
  const email = globalConfig.get(`users.${userId}.email`) as string | undefined
  const switchCommand = chalk.cyanBright(email ? `netlify switch --email ${email}` : 'netlify switch')
  const deleteSteps = `run ${switchCommand} to select this account again, then run ${chalk.cyanBright(
    'netlify logout --forget',
  )}`
  if (globalConfig.get(`users.${userId}.auth.token`)) {
    warn(`Your auth token is still stored in plaintext at ${getLegacyConfigFilePath()}.
To delete it from this device, ${deleteSteps}.`)
  } else if (location === 'keychain') {
    log(`Your auth token is still saved in your keychain so you can switch back to this account later.
To delete it, ${deleteSteps}.`)
  }
}

const handleStoredTokens = async (
  options: OptionValues,
  globalConfig: GlobalConfig,
  currentUserId: string | undefined,
  location: TokenLocation,
): Promise<void> => {
  if (options.all) {
    await forgetAccounts(
      globalConfig,
      getSavedAccountIds(globalConfig),
      `run ${chalk.cyanBright('netlify logout --all')} again`,
    )
    return
  }
  if (!currentUserId) return
  if (!options.forget) {
    explainKeptToken(globalConfig, currentUserId, location)
    return
  }
  await forgetAccounts(
    globalConfig,
    [currentUserId],
    `run ${chalk.cyanBright('netlify switch')} to select the account and ${chalk.cyanBright(
      'netlify logout --forget',
    )} again`,
  )
  warnAboutRemainingAccounts(globalConfig, currentUserId)
}

const exitAlreadyLoggedOut = (options: OptionValues, globalConfig: GlobalConfig): never => {
  log(`Already logged out`)
  log()
  log('To login run "netlify login"')
  if (options.forget) warnAboutRemainingAccounts(globalConfig)
  return exit()
}

const exitWithEnvTokenStillSet = (): never => {
  log('The "process.env.NETLIFY_AUTH_TOKEN" is still set in your terminal session')
  log()
  log('To logout completely, unset the environment variable')
  log()
  return exit()
}

export const logout = async (options: OptionValues, command: BaseCommand) => {
  const { globalConfig } = command.netlify
  const [accessToken, location] = await getToken()
  const currentUserId = (globalConfig.get('userId') as string | null | undefined) ?? undefined
  const savedAccountIds = getSavedAccountIds(globalConfig)
  // A locked keychain hides the token without logging the account out, so a selected account still counts
  const hasSelectedAccount = currentUserId != null && savedAccountIds.includes(currentUserId)
  const hasTokensToDelete = Boolean(options.all) && savedAccountIds.length > 0

  if (!accessToken && !hasSelectedAccount && !hasTokensToDelete) exitAlreadyLoggedOut(options, globalConfig)

  await track('user_logout', { forget: Boolean(options.forget), all: Boolean(options.all) })

  await handleStoredTokens(options, globalConfig, currentUserId, location)
  globalConfig.set('userId', null)

  if (location === 'env') exitWithEnvTokenStillSet()

  log(`Logging you out of Netlify. Come back soon!`)
}
