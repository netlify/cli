
import { OptionValues } from 'commander'

import { exit, getToken, log } from '../../utils/command-helpers.mjs'
import { track } from '../../utils/telemetry/index.mjs'
import BaseCommand from '../base-command.mjs'


export const logout = async (options: OptionValues, command: BaseCommand) => {
  // @ts-expect-error TS(2554) FIXME: Expected 1 arguments, but got 0.
  const [accessToken, location] = await getToken()

  if (!accessToken) {
    log(`Already logged out`)
    log()
    log('To login run "netlify login"')
    exit()
  }

  await track('user_logout')

  // unset userID without deleting key
  command.netlify.globalConfig.set('userId', null)

  if (location === 'env') {
    log('The "process.env.NETLIFY_AUTH_TOKEN" is still set in your terminal session')
    log()
    log('To logout completely, unset the environment variable')
    log()
    exit()
  }

  log(`Logging you out of Netlify. Come back soon!`)
}
