import clean from 'clean-deep'
import { OptionValues } from 'commander'
import prettyjson from 'prettyjson'

import { chalk, getToken, logJson } from '../../utils/command-helpers.js'
import BaseCommand from '../base-command.js'
import { NetlifyLog, intro, outro } from '../../utils/styles/index.js'
import { exit } from 'process'

export const status = async (options: OptionValues, command: BaseCommand) => {
  intro('status')
  const { api, globalConfig, site, siteInfo } = command.netlify
  const current = globalConfig.get('userId')
  const [accessToken] = await getToken()

  if (!accessToken) {
    NetlifyLog.error(`Not logged in. Please log in to see site status.`, { exit: false })
    NetlifyLog.info('Login with "netlify login" command')
    outro({ exit: true })
  }

  const siteId = site.id
  NetlifyLog.step('Current Netlify User')

  let accounts
  let user

  try {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;[accounts, user] = await Promise.all([api.listAccountsForUser(), api.getCurrentUser()])
  } catch (error_) {
    // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
    if (error_.status === 401) {
      NetlifyLog.error(
        'Your session has expired. Please try to re-authenticate by running `netlify logout` and `netlify login`.',
      )
    }
  }

  const ghuser = command.netlify.globalConfig.get(`users.${current}.auth.github.user`)
  const accountData = {
    Name: user.full_name,
    Email: user.email,
    GitHub: ghuser,
  }
  const teamsData = {}

  // @ts-expect-error TS(7006) FIXME: Parameter 'team' implicitly has an 'any' type.
  accounts.forEach((team) => {
    // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    teamsData[team.name] = team.roles_allowed.join(' ')
  })

  // @ts-expect-error TS(2339) FIXME: Property 'Teams' does not exist on type '{ Name: a... Remove this comment to see the full error message
  accountData.Teams = teamsData

  // @ts-expect-error
  const cleanAccountData = clean(accountData)

  NetlifyLog.message(prettyjson.render(cleanAccountData))

  if (!siteId) {
    NetlifyLog.warn('Did you run `netlify link` yet?')
    NetlifyLog.error(`You don't appear to be in a folder that is linked to a site`)
  }

  if (!siteInfo) {
    NetlifyLog.error(`No site info found for site ${siteId}`)
  }

  // Json only logs out if --json flag is passed
  if (options.json) {
    logJson({
      account: cleanAccountData,
      siteData: {
        'site-name': `${siteInfo.name}`,
        'config-path': site.configPath,
        'admin-url': siteInfo.admin_url,
        'site-url': siteInfo.ssl_url || siteInfo.url,
        'site-id': siteInfo.id,
      },
    })
  }

  NetlifyLog.step('Netlify Site Info')
  NetlifyLog.message(
    prettyjson.render({
      'Current site': `${siteInfo.name}`,
      'Netlify TOML': site.configPath,
      'Admin URL': chalk.magentaBright(siteInfo.admin_url),
      'Site URL': chalk.cyanBright(siteInfo.ssl_url || siteInfo.url),
      'Site Id': chalk.yellowBright(siteInfo.id),
    }),
  )
  outro({ exit: true })
}
