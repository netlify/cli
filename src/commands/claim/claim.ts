import { chalk, log, logAndThrowError, NETLIFYDEVLOG } from '../../utils/command-helpers.js'
import { claimDropSite } from '../../utils/deploy/drop-api.js'
import type BaseCommand from '../base-command.js'

export const claim = async (siteId: string, dropToken: string, command: BaseCommand) => {
  await command.authenticate()

  const apiBase = command.netlify.api.basePath
  const dropApiOptions = {
    apiBase,
    userAgent: command.netlify.api.defaultHeaders['User-agent'] || 'netlify-cli',
  }

  const authToken = command.netlify.api.accessToken
  if (!authToken) {
    return logAndThrowError('You must be logged in to claim a site. Run `netlify login` first.')
  }

  await claimDropSite(dropApiOptions, siteId, dropToken, authToken)

  command.netlify.state.set('siteId', siteId)

  log(`\n${NETLIFYDEVLOG} Site claimed successfully and linked to your account!`)
  log(`You can now deploy to this site with: ${chalk.cyanBright('netlify deploy --prod')}\n`)
}
