// @ts-check
// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const url = require('url')

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'fetch'.
const fetch = require('node-fetch')

// supported repo host types
const GITHUB = 'GitHub'

/**
 * Takes a url like https://github.com/netlify-labs/all-the-functions/tree/master/functions/9-using-middleware
 * and returns https://api.github.com/repos/netlify-labs/all-the-functions/contents/functions/9-using-middleware
 */
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'readRepoUR... Remove this comment to see the full error message
const readRepoURL = async function (_url: any) {
  // TODO: use `url.URL()` instead
  // eslint-disable-next-line n/no-deprecated-api
  const URL = url.parse(_url)
  const repoHost = validateRepoURL(_url)
  if (repoHost !== GITHUB) throw new Error('only GitHub repos are supported for now')
  const [ownerAndRepo, contentsPath] = parseRepoURL(repoHost, URL)
  const folderContents = await getRepoURLContents(repoHost, ownerAndRepo, contentsPath)
  return folderContents
}

const getRepoURLContents = async function (repoHost: any, ownerAndRepo: any, contentsPath: any) {
  // naive joining strategy for now
  if (repoHost === GITHUB) {
    // https://developer.github.com/v3/repos/contents/#get-contents
    const APIURL = `https://api.github.com/repos/${ownerAndRepo}/contents/${contentsPath}`
    try {
      const res = await fetch(APIURL)
      return await res.json()
    } catch (error) {
      console.error(`Error occurred while fetching ${APIURL}`, error)
    }
  }
  // @ts-expect-error TS(2554) FIXME: Expected 0-1 arguments, but got 2.
  throw new Error('unsupported host ', repoHost)
}

const validateRepoURL = function (_url: any) {
  // TODO: use `url.URL()` instead
  // eslint-disable-next-line n/no-deprecated-api
  const URL = url.parse(_url)
  if (URL.host !== 'github.com') return null
  // other validation logic here
  return GITHUB
}
const parseRepoURL = function (repoHost: any, URL: any) {
  // naive splitting strategy for now
  if (repoHost === GITHUB) {
    // https://developer.github.com/v3/repos/contents/#get-contents
    // what if it's not master? note that our contents retrieval may assume it is master
    const [ownerAndRepo, contentsPath] = URL.path.slice(1).split('/tree/master/')
    return [ownerAndRepo, contentsPath]
  }
  throw new Error(`Unsupported host ${repoHost}`)
}

// @ts-expect-error TS(2580) FIXME: Cannot find name 'module'. Do you need to install ... Remove this comment to see the full error message
module.exports = {
  parseRepoURL,
  readRepoURL,
  validateRepoURL,
}
