import { OptionValues } from 'commander'

import { deleteTokenFromKeychain } from '../../lib/secure-storage.js'
import { exit, getToken, log } from '../../utils/command-helpers.js'
import { track } from '../../utils/telemetry/index.js'
import BaseCommand from '../base-command.js'

export const logout = async (_options: OptionValues, command: BaseCommand) => {
  const [accessToken, location] = await getToken()

  if (!accessToken) {
    log(`Already logged out`)
    log()
    log('To login run "netlify login"')
    exit()
  }

  await track('user_logout')

  const userId = command.netlify.globalConfig.get('userId') as string | undefined
  if (userId) {
    await deleteTokenFromKeychain(userId)
    command.netlify.globalConfig.set(`users.${userId}.auth.token`, undefined)
  }
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
