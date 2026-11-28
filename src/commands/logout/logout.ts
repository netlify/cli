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

const warnAboutRemainingAccounts = (globalConfig: GlobalConfig): void => {
  const remaining = getSavedAccountIds(globalConfig)
  if (remaining.length === 0) return
  const noun = remaining.length === 1 ? 'account on this device still has a' : 'accounts on this device still have'
  warn(
    `${remaining.length.toString()} other ${noun} saved auth token${remaining.length === 1 ? '' : 's'}:
${formatAccountList(globalConfig, remaining)}
To delete ${remaining.length === 1 ? 'it' : 'them'} as well, run ${chalk.cyanBright('netlify logout --all')}.`,
  )
}

// Stored tokens are kept by default so `netlify switch` can return to the account without logging in again
const explainKeptToken = (globalConfig: GlobalConfig, userId: string, location: TokenLocation): void => {
  const forgetCommand = chalk.cyanBright('netlify logout --forget')
  if (globalConfig.get(`users.${userId}.auth.token`)) {
    warn(`Your auth token is still stored in plaintext at ${getLegacyConfigFilePath()}.
To delete it from this device, run ${forgetCommand}.`)
  } else if (location === 'keychain') {
    log(
      `Your auth token is still saved in your keychain so ${chalk.cyanBright(
        'netlify switch',
      )} can return to this account. To delete it, run ${forgetCommand}.`,
    )
  }
}

export const logout = async (options: OptionValues, command: BaseCommand) => {
  const { globalConfig } = command.netlify
  const [accessToken, location] = await getToken()
  const currentUserId = (globalConfig.get('userId') as string | null | undefined) ?? undefined
  const savedAccountIds = getSavedAccountIds(globalConfig)

  if (!accessToken && !(options.all && savedAccountIds.length > 0)) {
    log(`Already logged out`)
    log()
    log('To login run "netlify login"')
    if (options.forget) warnAboutRemainingAccounts(globalConfig)
    exit()
  }

  await track('user_logout', { forget: Boolean(options.forget), all: Boolean(options.all) })

  if (options.all) {
    await forgetAccounts(globalConfig, savedAccountIds, `run ${chalk.cyanBright('netlify logout --all')} again`)
  } else if (options.forget && currentUserId) {
    await forgetAccounts(
      globalConfig,
      [currentUserId],
      `run ${chalk.cyanBright('netlify switch')} to select the account and ${chalk.cyanBright(
        'netlify logout --forget',
      )} again`,
    )
    warnAboutRemainingAccounts(globalConfig)
  } else if (currentUserId) {
    explainKeptToken(globalConfig, currentUserId, location)
  }

  globalConfig.set('userId', null)

  if (location === 'env') {
    log('The "process.env.NETLIFY_AUTH_TOKEN" is still set in your terminal session')
    log()
    log('To logout completely, unset the environment variable')
    log()
    exit()
  }

  log(`Logging you out of Netlify. Come back soon!`)
}
