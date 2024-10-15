import { OptionValues } from 'commander'

import { chalk, exit, getToken, log } from '../../utils/command-helpers.js'
import BaseCommand from '../base-command.js'

const msg = function (location: 'env' | 'flag' | 'config') {
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
