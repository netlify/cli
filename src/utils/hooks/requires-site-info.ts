import { error, warn, APIError } from '../command-helpers.js'

/**
 * A preAction hook that errors out if siteInfo is an empty object
 * @param {*} command
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'command' implicitly has an 'any' type.
const requiresSiteInfo = async (command) => {
  const { api, site } = command.netlify
  const siteId = site.id
  if (!siteId) {
    warn('Did you run `netlify link` yet?')
    error(`You don't appear to be in a folder that is linked to a site`)
    return
  }
  try {
    await api.getSite({ siteId })
  } catch (error_) {
    // unauthorized
    if ((error_ as APIError).status === 401) {
      warn(`Log in with a different account or re-link to a site you have permission for`)
      error(`Not authorized to view the currently linked site (${siteId})`)
      return
    }
    // missing
    if ((error_ as APIError).status === 404) {
      error(`The site this folder is linked to can't be found`)
      return
    }

    error(error_)
    return
  }
}

export default requiresSiteInfo
