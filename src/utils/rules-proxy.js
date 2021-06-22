const fs = require('fs')
const path = require('path')
const url = require('url')

const chokidar = require('chokidar')
const cookie = require('cookie')
const { parseAllRedirects } = require('netlify-redirect-parser')
const redirector = require('netlify-redirector')

const { NETLIFYDEVWARN, NETLIFYDEVLOG } = require('./logo')

// Parse, normalize and validate all redirects from `_redirects` files
// and `netlify.toml`
const parseRedirectRules = async function ({ redirectsFiles, configPath }) {
  try {
    const rules = await parseAllRedirects({ redirectsFiles, netlifyConfigPath: configPath })
    return rules.map(normalizeRule)
  } catch (error) {
    console.error(`${NETLIFYDEVWARN} Warnings while parsing redirects:
${error.message}`)
    return []
  }
}

// `netlify-redirector` does not handle the same shape as the backend:
//  - `from` is called `origin`
//  - `query` is called `params`
//  - `conditions.role|country|language` are capitalized
const normalizeRule = function ({ from, query, conditions: { role, country, language, ...conditions }, ...rule }) {
  return {
    ...rule,
    origin: from,
    params: query,
    conditions: {
      ...conditions,
      ...(role && { Role: role }),
      ...(country && { Country: country }),
      ...(language && { Language: language }),
    },
  }
}

const onChanges = function (files, listener) {
  files.forEach((file) => {
    const watcher = chokidar.watch(file)
    watcher.on('change', listener)
    watcher.on('unlink', listener)
  })
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

const createRewriter = async function ({ distDir, projectDir, jwtSecret, jwtRoleClaim, configPath }) {
  let matcher = null
  const redirectsFiles = [...new Set([path.resolve(distDir, '_redirects'), path.resolve(projectDir, '_redirects')])]
  const getRedirectRules = parseRedirectRules.bind(undefined, { redirectsFiles, configPath })
  let rules = await getRedirectRules()

  const watchedRedirectFiles = configPath === undefined ? redirectsFiles : [...redirectsFiles, configPath]
  onChanges(watchedRedirectFiles, async () => {
    console.log(
      `${NETLIFYDEVLOG} Reloading redirect rules from`,
      watchedRedirectFiles.filter(fs.existsSync).map((configFile) => path.relative(projectDir, configFile)),
    )
    rules = await getRedirectRules()
    matcher = null
  })

  const getMatcher = async () => {
    if (matcher) return matcher

    if (rules.length !== 0) {
      return (matcher = await redirector.parseJSON(JSON.stringify(rules), {
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
    const reqUrl = new url.URL(
      req.url,
      `${req.protocol || (req.headers.scheme && `${req.headers.scheme}:`) || 'http:'}//${
        req.hostname || req.headers.host
      }`,
    )
    const cookieValues = cookie.parse(req.headers.cookie || '')
    const headers = {
      'x-language': cookieValues.nf_lang || getLanguage(req.headers),
      'x-country': cookieValues.nf_country || getCountry(req),
      ...req.headers,
    }

    // Definition: https://github.com/netlify/libredirect/blob/e81bbeeff9f7c260a5fb74cad296ccc67a92325b/node/src/redirects.cpp#L28-L60
    const matchReq = {
      scheme: reqUrl.protocol.replace(/:.*$/, ''),
      host: reqUrl.hostname,
      path: reqUrl.pathname,
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
  parseRedirectRules,
  onChanges,
  getLanguage,
  createRewriter,
}
