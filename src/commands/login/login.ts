import { OptionValues } from 'commander'

import { chalk, exit, getToken, log, logAndThrowError } from '../../utils/command-helpers.js'
import { TokenLocation } from '../../utils/types.js'
import BaseCommand from '../base-command.js'

const msg = function (location: TokenLocation) {
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
  if (options.request && options.check) {
    return logAndThrowError('`--request` and `--check` are mutually exclusive')
  }

  if (options.request) {
    const { loginRequest } = await import('./login-request.js')
    await loginRequest()
    return
  }

  if (options.check) {
    const { loginCheck } = await import('./login-check.js')
    await loginCheck(options)
    return
  }

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
