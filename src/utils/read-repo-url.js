const url = require('url')
const fetch = require('node-fetch')
const { safeJoin } = require('safe-join')

// supported repo host types
const GITHUB = Symbol('GITHUB')
// const BITBUCKET = Symbol('BITBUCKET')
// const GITLAB = Symbol('GITLAB')

/**
 * Takes a url like https://github.com/netlify-labs/all-the-functions/tree/master/functions/9-using-middleware
 * and returns https://api.github.com/repos/netlify-labs/all-the-functions/contents/functions/9-using-middleware
 */
async function readRepoURL(_url) {
  // TODO: use `url.URL()` instead
  // eslint-disable-next-line node/no-deprecated-api
  const URL = url.parse(_url)
  const repoHost = validateRepoURL(_url)
  if (repoHost !== GITHUB) throw new Error('only github repos are supported for now')
  const [owner_and_repo, contents_path] = parseRepoURL(repoHost, URL)
  const folderContents = await getRepoURLContents(repoHost, owner_and_repo, contents_path)
  return folderContents
}

async function getRepoURLContents(repoHost, owner_and_repo, contents_path) {
  // naive joining strategy for now
  if (repoHost === GITHUB) {
    // https://developer.github.com/v3/repos/contents/#get-contents
    const APIURL = safeJoin('https://api.github.com/repos', owner_and_repo, 'contents', contents_path)
    return fetch(APIURL)
      .then(x => x.json())
      .catch(error => console.error('Error occurred while fetching ', APIURL, error))
  }
  throw new Error('unsupported host ', repoHost)
}

function validateRepoURL(_url) {
  // TODO: use `url.URL()` instead
  // eslint-disable-next-line node/no-deprecated-api
  const URL = url.parse(_url)
  if (URL.host !== 'github.com') return null
  // other validation logic here
  return GITHUB
}
function parseRepoURL(repoHost, URL) {
  // naive splitting strategy for now
  if (repoHost === GITHUB) {
    // https://developer.github.com/v3/repos/contents/#get-contents
    const [owner_and_repo, contents_path] = URL.path.split('/tree/master') // what if it's not master? note that our contents retrieval may assume it is master
    return [owner_and_repo, contents_path]
  }
  throw new Error('unsupported host ', repoHost)
}

module.exports = {
  readRepoURL,
  validateRepoURL,
}
