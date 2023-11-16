
import { OptionValues } from 'commander'

import { chalk, exit, getToken, log } from '../../utils/command-helpers.mjs'
import BaseCommand from '../base-command.mjs'

// @ts-expect-error TS(7006) FIXME: Parameter 'location' implicitly has an 'any' type.
const msg = function (location) {
  switch (location) {
    case 'env':
      return 'via process.env.NETLIFY_AUTH_TOKEN set in your terminal session'
    case 'flag':
      return 'via CLI --auth flag'
    case 'config':
      return 'via netlify config on your machine'
    default:
      return ''
  }
}


export const login = async (options: OptionValues, command: BaseCommand) => {
  // @ts-expect-error TS(2554) FIXME: Expected 1 arguments, but got 0.
  const [accessToken, location] = await getToken()

  command.setAnalyticsPayload({ new: options.new })

  if (accessToken && !options.new) {
    log(`Already logged in ${msg(location)}`)
    log()
    log(`Run ${chalk.cyanBright('netlify status')} for account details`)
    log()
    log(`or run ${chalk.cyanBright('netlify switch')} to switch accounts`)
    log()
    log(`To see all available commands run: ${chalk.cyanBright('netlify help')}`)
    log()
    return exit()
  }

  await command.expensivelyAuthenticate()
}
