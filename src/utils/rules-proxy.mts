// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'path'.
const path = require('path')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'chokidar'.
const chokidar = require('chokidar')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'cookie'.
const cookie = require('cookie')
const redirector = require('netlify-redirector')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'pFilter'.
const pFilter = require('p-filter')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'fileExists... Remove this comment to see the full error message
const { fileExistsAsync } = require('../lib/fs.cjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'NETLIFYDEV... Remove this comment to see the full error message
const { NETLIFYDEVLOG } = require('./command-helpers.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'parseRedir... Remove this comment to see the full error message
const { parseRedirects } = require('./redirects.cjs')

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const watchers: $TSFixMe = []

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'onChanges'... Remove this comment to see the full error message
const onChanges = function (files: $TSFixMe, listener: $TSFixMe) {
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  files.forEach((file: $TSFixMe) => {
    const watcher = chokidar.watch(file)
    watcher.on('change', listener)
    watcher.on('unlink', listener)
    watchers.push(watcher)
  })
}

const getWatchers = function () {
  return watchers
}

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const getLanguage = function (headers: $TSFixMe) {
  if (headers['accept-language']) {
    return headers['accept-language'].split(',')[0].slice(0, 2)
  }
  return 'en'
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createRewr... Remove this comment to see the full error message
const createRewriter = async function ({
  configPath,
  distDir,
  geoCountry,
  jwtRoleClaim,
  jwtSecret,
  projectDir
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) {
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  let matcher: $TSFixMe = null
  const redirectsFiles = [...new Set([path.resolve(distDir, '_redirects'), path.resolve(projectDir, '_redirects')])]
  let redirects = await parseRedirects({ redirectsFiles, configPath })

  const watchedRedirectFiles = configPath === undefined ? redirectsFiles : [...redirectsFiles, configPath]
  onChanges(watchedRedirectFiles, async () => {
    const existingRedirectsFiles = await pFilter(watchedRedirectFiles, fileExistsAsync)
    console.log(
      `${NETLIFYDEVLOG} Reloading redirect rules from`,
      // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
      existingRedirectsFiles.map((redirectFile: $TSFixMe) => path.relative(projectDir, redirectFile)),
    )
    redirects = await parseRedirects({ redirectsFiles, configPath })
    matcher = null
  })

  const getMatcher = async () => {
    if (matcher) return matcher

    if (redirects.length !== 0) {
      return (matcher = await redirector.parseJSON(JSON.stringify(redirects), {
        jwtSecret,
        jwtRoleClaim,
      }))
    }
    return {
      match() {
        return null
      },
    }
  }

  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  return async function rewriter(req: $TSFixMe) {
    const matcherFunc = await getMatcher()
    const reqUrl = new URL(
      req.url,
      `${req.protocol || (req.headers.scheme && `${req.headers.scheme}:`) || 'http:'}//${
        req.hostname || req.headers.host
      }`,
    )
    const cookieValues = cookie.parse(req.headers.cookie || '')
    const headers = {
      'x-language': cookieValues.nf_lang || getLanguage(req.headers),
      'x-country': cookieValues.nf_country || geoCountry || 'us',
      ...req.headers,
    }

    // Definition: https://github.com/netlify/libredirect/blob/e81bbeeff9f7c260a5fb74cad296ccc67a92325b/node/src/redirects.cpp#L28-L60
    const matchReq = {
      scheme: reqUrl.protocol.replace(/:.*$/, ''),
      host: reqUrl.hostname,
      path: decodeURIComponent(reqUrl.pathname),
      query: reqUrl.search.slice(1),
      headers,
      cookieValues,
      // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
      getHeader: (name: $TSFixMe) => headers[name.toLowerCase()] || '',
      // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
      getCookie: (key: $TSFixMe) => cookieValues[key] || '',
    }
    const match = matcherFunc.match(matchReq)
    return match
  };
}

module.exports = {
  onChanges,
  getLanguage,
  createRewriter,
  getWatchers,
}
