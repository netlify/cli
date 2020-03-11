const path = require('path')
const fs = require('fs')
const url = require('url')
const redirector = require('netlify-redirector')
const chokidar = require('chokidar')
const cookie = require('cookie')
const redirectParser = require('netlify-redirect-parser')
const { NETLIFYDEVWARN } = require('../utils/logo')

async function parseFile(parser, name, filePath) {
  const result = await parser(filePath)
  if (result.errors.length) {
    console.error(`${NETLIFYDEVWARN} Warnings while parsing ${name} file:`)
    result.errors.forEach(err => {
      console.error(`  ${err.lineNum}: ${err.line} -- ${err.reason}`)
    })
  }
  return result.success
}

async function parseRules(configFiles) {
  const rules = []

  for (const file of configFiles) {
    if (!fs.existsSync(file)) continue

    const fileName = file.split(path.sep).pop()
    if (fileName.endsWith('_redirects')) {
      rules.push(...(await parseFile(redirectParser.parseRedirectsFormat, fileName, file)))
    } else {
      rules.push(...(await parseFile(redirectParser.parseNetlifyConfig, fileName, file)))
    }
  }

  return rules
}

function onChanges(files, cb) {
  files.forEach(file => {
    const watcher = chokidar.watch(file)
    watcher.on('change', cb)
    watcher.on('add', cb)
    watcher.on('unlink', cb)
  })
}

function getLanguage(req) {
  if (req.headers['accept-language']) {
    return req.headers['accept-language'].split(',')[0].slice(0, 2)
  }
  return 'en'
}

function getCountry(req) {
  return 'us'
}

module.exports = function({ publicFolder, baseFolder, jwtSecret, jwtRole, configPath }) {
  let matcher = null
  const projectDir = path.resolve(baseFolder || process.cwd())
  const configFiles = [
    path.resolve(projectDir, '_redirects'),
    path.resolve(publicFolder, '_redirects'),
    path.resolve(configPath || path.resolve(publicFolder, 'netlify.yml')),
  ]
  let rules = []

  onChanges(configFiles, async () => {
    rules = (await parseRules(configFiles)).filter(r => !(r.path === '/*' && r.to === '/index.html' && r.status === 200))
    matcher = null
  })

  const getMatcher = async () => {
    if (matcher) return matcher

    if (rules.length) {
      return matcher = await redirector.parseJSON(JSON.stringify(rules), {
        jwtSecret: jwtSecret || 'secret',
        jwtRole: jwtRole || 'app_metadata.authorization.roles'
      })
    }
    return {
      match() {
        return null
      }
    }
  }

  return function(req, res, next) {
    getMatcher().then(matcher => {
      const reqUrl = new url.URL(
        req.url,
        `${req.protocol || (req.headers.scheme && req.headers.scheme + ':') || 'http:'}//${req.hostname ||
          req.headers['host']}`
      )
      const cookieValues = cookie.parse(req.headers.cookie || '')
      const headers = Object.assign(
        {},
        {
          'x-language': cookieValues.nf_lang || getLanguage(req),
          'x-country': cookieValues.nf_country || getCountry(req)
        },
        req.headers
      )

      // Definition: https://github.com/netlify/libredirect/blob/e81bbeeff9f7c260a5fb74cad296ccc67a92325b/node/src/redirects.cpp#L28-L60
      const matchReq = {
        scheme: reqUrl.protocol,
        host: reqUrl.hostname,
        path: reqUrl.pathname,
        query: reqUrl.search.slice(1),
        headers,
        cookieValues,
        getHeader: name => headers[name.toLowerCase()] || '',
        getCookie: key => cookieValues[key] || ''
      }
      const match = matcher.match(matchReq)
      if (match) return next(match)

      next()
    })
  }
}
