// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'exit'.
const { exit, getToken, log, track } = require('../../utils/index.mjs')

/**
 * The logout command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const logout = async (options: $TSFixMe, command: $TSFixMe) => {
  // @ts-expect-error TS(2554): Expected 1 arguments, but got 0.
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

/**
 * Creates the `netlify logout` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createLogo... Remove this comment to see the full error message
const createLogoutCommand = (program: $TSFixMe) => program.command('logout', { hidden: true }).description('Logout of your Netlify account').action(logout)

module.exports = { createLogoutCommand, logout }
