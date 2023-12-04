import clean from 'clean-deep'
import { Request as ExpressRequest, Response as ExpressResponse } from 'express'

import { getToken } from '../../../utils/command-helpers.js'
import { UIContext } from '../context.js'

export const handleStatus = async (context: UIContext, req: ExpressRequest, res: ExpressResponse) => {
  const { api, globalConfig, site, siteInfo } = context
  const current = globalConfig.get('userId')
  const [accessToken] = await getToken()

  if (!accessToken) {
    return res.status(401).json({
      error: 'Not logged in. Run `netlify login` to see site status.',
    })
  }

  const siteId = site.id

  let user
  let accounts

  try {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;[accounts, user] = await Promise.all([api.listAccountsForUser(), api.getCurrentUser()])
  } catch (error) {
    // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
    if (error.status === 401) {
      return res.status(401).json({
        error:
          'Your session has expired. Please try to re-authenticate by running `netlify logout` and `netlify login`.',
      })
    }

    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' })
  }

  const ghuser = globalConfig.get(`users.${current}.auth.github.user`)
  const accountData = {
    Name: user.full_name,
    Email: user.email,
    GitHub: ghuser,
  }
  const teamsData = {}

  // @ts-expect-error TS(7006) FIXME: Parameter 'team' implicitly has an 'any' type.
  accounts?.forEach((team) => {
    // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    teamsData[team.name] = team.roles_allowed.join(' ')
  })

  // @ts-expect-error TS(2339) FIXME: Property 'Teams' does not exist on type '{ Name: a... Remove this comment to see the full error message
  accountData.Teams = teamsData

  // @ts-expect-error TS(2349) FIXME: This expression is not callable.
  const cleanAccountData = clean(accountData)

  return res.status(200).json({
    account: cleanAccountData,
    siteData: siteId
      ? siteInfo && {
          'site-name': `${siteInfo.name}`,
          'config-path': site.configPath,
          'admin-url': siteInfo.admin_url,
          'site-url': siteInfo.ssl_url || siteInfo.url,
          'site-id': siteInfo.id,
        }
      : {
          errors: ['Did you run `netlify link` yet?', `You don't appear to be in a folder that is linked to a site`],
        },
  })
}
