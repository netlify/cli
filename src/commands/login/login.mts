// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'chalk'.
const { chalk, exit, getToken, log } = require('../../utils/index.mjs')

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const msg = function (location: $TSFixMe) {
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
 * @param {import('../base-command').BaseCommand} command
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'login'.
const login = async (options: $TSFixMe, command: $TSFixMe) => {
  // @ts-expect-error TS(2554): Expected 1 arguments, but got 0.
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
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createLogi... Remove this comment to see the full error message
const createLoginCommand = (program: $TSFixMe) => program
  .command('login')
  .description(
    `Login to your Netlify account
Opens a web browser to acquire an OAuth token.`,
  )
  .option('--new', 'Login to new Netlify account')
  .action(login)

module.exports = { createLoginCommand, login, msg }
