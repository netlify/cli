import type { Command } from 'commander'

import { logAndThrowError, warn, type APIError } from '../command-helpers.js'
import type BaseCommand from '../../commands/base-command.js'

/**
 * A preAction hook that errors out if siteInfo is an empty object
 */
const requiresSiteInfo = async (command: Command) => {
  // commander (at least the version we're on) is typed such that `.preAction()` can't accept
  // a subclass of `Command`. This type assertion avoids a lot of type noise in every call site.
  const { api, site } = (command as BaseCommand).netlify
  const siteId = site.id
  if (!siteId) {
    warn('Did you run `netlify link` yet?')
    return logAndThrowError(`You don't appear to be in a folder that is linked to a site`)
  }
  try {
    await api.getSite({ siteId })
  } catch (error_) {
    // unauthorized
    if ((error_ as APIError).status === 401) {
      warn(`Log in with a different account or re-link to a site you have permission for`)
      return logAndThrowError(`Not authorized to view the currently linked site (${siteId})`)
    }
    // missing
    if ((error_ as APIError).status === 404) {
      return logAndThrowError(`The site this folder is linked to can't be found`)
    }

    return logAndThrowError(error_)
  }
}

export default requiresSiteInfo
