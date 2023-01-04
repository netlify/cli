// @ts-check
import { chalk, exit, getToken, log } from '../../utils/command-helpers.mjs'

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

/**
 * The login command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
export const login = async (options, command) => {
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

/**
 * Creates the `netlify login` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createLoginCommand = (program) =>
  program
    .command('login')
    .description(
      `Login to your Netlify account
Opens a web browser to acquire an OAuth token.`,
    )
    .option('--new', 'Login to new Netlify account')
    .action(login)
