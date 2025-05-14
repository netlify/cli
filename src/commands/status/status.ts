import clean from 'clean-deep'
import type { OptionValues } from 'commander'
import prettyjson from 'prettyjson'

import {
  chalk,
  logAndThrowError,
  exit,
  getToken,
  log,
  logJson,
  warn,
  type APIError,
} from '../../utils/command-helpers.js'
import type BaseCommand from '../base-command.js'

export const status = async (options: OptionValues, command: BaseCommand) => {
  const { accounts, api, globalConfig, site, siteInfo } = command.netlify
  const currentUserId = globalConfig.get('userId') as string | undefined
  const [accessToken] = await getToken()

  if (!accessToken) {
    log(`Not logged in. Please log in to see project status.`)
    log()
    log('Login with "netlify login" command')
    return exit()
  }

  const siteId = site.id

  log(`──────────────────────┐
 Current Netlify User │
──────────────────────┘`)

  let user

  try {
    user = await api.getCurrentUser()
  } catch (error_) {
    if ((error_ as APIError).status === 401) {
      return logAndThrowError(
        'Your session has expired. Please try to re-authenticate by running `netlify logout` and `netlify login`.',
      )
    } else {
      return logAndThrowError(error_)
    }
  }

  const ghuser =
    currentUserId != null
      ? (globalConfig.get(`users.${currentUserId}.auth.github.user`) as string | undefined)
      : undefined
  const accountData = {
    Name: user.full_name,
    Email: user.email,
    GitHub: ghuser,
    Teams: accounts.map(({ name }) => name),
  }

  const cleanAccountData =
    // TODO(serhalp) `deep-clean` type declaration is invalid (this is obscured by `skipLibCheck`). Open a PR or use
    // another lib.
    (clean as unknown as <T extends Record<string | number | symbol, unknown>>(obj: T) => Partial<T>)(accountData)

  log(prettyjson.render(cleanAccountData))

  if (!siteId) {
    warn('Did you run `netlify link` yet?')
    return logAndThrowError(`You don't appear to be in a folder that is linked to a project`)
  }

  // Json only logs out if --json flag is passed
  if (options.json) {
    logJson({
      account: cleanAccountData,
      siteData: {
        'site-name': siteInfo.name,
        'config-path': site.configPath,
        'admin-url': siteInfo.admin_url,
        'site-url': siteInfo.ssl_url || siteInfo.url,
        'site-id': siteInfo.id,
      },
    })
  }

  log(`────────────────────┐
 Netlify Project Info  │
────────────────────┘`)
  log(
    prettyjson.render({
      'Current project': siteInfo.name,
      'Netlify TOML': site.configPath,
      'Admin URL': chalk.magentaBright(siteInfo.admin_url),
      'Project URL': chalk.cyanBright(siteInfo.ssl_url || siteInfo.url),
      'Project Id': chalk.yellowBright(siteInfo.id),
    }),
  )
  log()
}
