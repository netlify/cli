// @ts-check
const path = require('path')

const chokidar = require('chokidar')
const cookie = require('cookie')
const redirector = require('netlify-redirector')
const pFilter = require('p-filter')

const { fileExistsAsync } = require('../lib/fs')

const { NETLIFYDEVLOG } = require('./command-helpers')
const { parseRedirects } = require('./redirects')

const watchers = []

const onChanges = function (files, listener) {
  files.forEach((file) => {
    const watcher = chokidar.watch(file)
    watcher.on('change', listener)
    watcher.on('unlink', listener)
    watchers.push(watcher)
  })
}

const getWatchers = function () {
  return watchers
}

const getLanguage = function (headers) {
  if (headers['accept-language']) {
    return headers['accept-language'].split(',')[0].slice(0, 2)
  }
  return 'en'
}

const getCountry = function () {
  return 'us'
}

const createRewriter = async function ({ configPath, distDir, jwtRoleClaim, jwtSecret, projectDir }) {
  let matcher = null
  const redirectsFiles = [...new Set([path.resolve(distDir, '_redirects'), path.resolve(projectDir, '_redirects')])]
  let redirects = await parseRedirects({ redirectsFiles, configPath })

  const watchedRedirectFiles = configPath === undefined ? redirectsFiles : [...redirectsFiles, configPath]
  onChanges(watchedRedirectFiles, async () => {
    const existingRedirectsFiles = await pFilter(watchedRedirectFiles, fileExistsAsync)
    console.log(
      `${NETLIFYDEVLOG} Reloading redirect rules from`,
      existingRedirectsFiles.map((redirectFile) => path.relative(projectDir, redirectFile)),
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

  return async function rewriter(req) {
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
      'x-country': cookieValues.nf_country || getCountry(),
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
      getHeader: (name) => headers[name.toLowerCase()] || '',
      getCookie: (key) => cookieValues[key] || '',
    }
    const match = matcherFunc.match(matchReq)
    return match
  }
}

module.exports = {
  onChanges,
  getLanguage,
  createRewriter,
  getWatchers,
}
