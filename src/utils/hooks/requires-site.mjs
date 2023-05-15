import { error, warn } from '../command-helpers.mjs'
/**
 * A preAction hook that errors out if siteInfo is an empty object
 * @param {*} command
 */
const requiresSite = async (command) => {
  const {api, site} = command.netlify
  const siteId = site.id
  if (!siteId) {
    warn('Did you run `netlify link` yet?')
    error(`You don't appear to be in a folder that is linked to a site`)
  }
  try {
    await api.getSite({ siteId })
  } catch (error_) {
    // unauthorized
    if (error_.status === 401) {
      warn(`Log in with a different account or re-link to a site you have permission for`)
      error(`Not authorized to view the currently linked site (${siteId})`)
    }
    // missing
    if (error_.status === 404) {
      error(`The site this folder is linked to can't be found`)
    }
    error(error_)
  }
}


export default requiresSite
