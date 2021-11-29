// @ts-check
const { exit, getToken, log, track } = require('../../utils')

/**
 * The logout command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const logout = async (options, command) => {
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
const createLogoutCommand = (program) =>
  program.command('logout', { hidden: true }).description('Logout of your Netlify account').action(logout)

module.exports = { createLogoutCommand, logout }
