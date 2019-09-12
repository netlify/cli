const path = require('path')
const fs = require('fs')
const url = require('url')
const redirector = require('netlify-redirector')
const chokidar = require('chokidar')
const proxy = require('http-proxy-middleware')
const cookie = require('cookie')
const redirectParser = require('./redirect-parser')
const {
  NETLIFYDEVLOG,
  NETLIFYDEVERR,
  NETLIFYDEVWARN,
} = require('netlify-cli-logo')

function isExternal(match) {
  return match.to && match.to.match(/^https?:\/\//)
}

function isRedirect(match) {
  return match.status && (match.status >= 300 && match.status <= 400)
}

function parseFile(parser, name, data) {
  const result = parser(data)
  if (result.errors.length) {
    console.error(`${NETLIFYDEVWARN} Warnings while parsing ${name} file:`)
    result.errors.forEach(err => {
      console.error(`  ${err.lineNum}: ${err.line} -- ${err.reason}`)
    })
  }
  return result.success
}

function parseRules(projectDir, publicDir) {
  let rules = []

  const generatedRedirectsPath = path.resolve(publicDir, '_redirects')
  if (fs.existsSync(generatedRedirectsPath)) {
    rules = rules.concat(
      parseFile(
        redirectParser.parseRedirectsFormat,
        '_redirects',
        fs.readFileSync(generatedRedirectsPath, 'utf-8')
      )
    )
  }

  const baseRedirectsPath = path.resolve(projectDir, '_redirects')
  if (fs.existsSync(baseRedirectsPath)) {
    rules = rules.concat(
      parseFile(
        redirectParser.parseRedirectsFormat,
        '_redirects',
        fs.readFileSync(baseRedirectsPath, 'utf-8')
      )
    )
  }

  const generatedTOMLPath = path.resolve(projectDir, 'netlify.toml')
  if (fs.existsSync(generatedTOMLPath)) {
    rules = rules.concat(
      parseFile(
        redirectParser.parseTomlFormat,
        'generated netlify.toml',
        fs.readFileSync(generatedTOMLPath, 'utf-8')
      )
    )
  }

  const baseTOMLPath = path.resolve(projectDir, 'netlify.toml')
  if (fs.existsSync(baseTOMLPath)) {
    rules = rules.concat(
      parseFile(
        redirectParser.parseTomlFormat,
        'base netlify.toml',
        fs.readFileSync(baseTOMLPath, 'utf-8')
      )
    )
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

module.exports = function(config) {
  let matcher = null
  const projectDir = path.resolve(config.baseFolder || process.cwd())

  onChanges([
    path.resolve(projectDir, 'netlify.toml'),
    path.resolve(projectDir, '_redirects'),
    path.resolve(config.publicFolder, 'netlify.toml'),
    path.resolve(config.publicFolder, '_redirects'),
  ], () => {
    matcher = null
  })

  const getMatcher = () => {
    if (matcher) {
      return Promise.resolve(matcher)
    }

    const rules = parseRules(projectDir, config.publicFolder)
      .filter(r => !(r.path === '/*' && r.to === '/index.html' && r.status === 200))

    if (rules.length) {
      return redirector
        .parseJSON(JSON.stringify(rules), {
          jwtSecret: config.jwtSecret || 'secret',
          jwtRole: config.jwtRole || 'app_metadata.authorization.roles',
        })
        .then(m => {
          matcher = m
          return matcher
        })
    }
    return Promise.resolve({
      match() {
        return null
      },
    })
  }

  function notStatic(pathname) {
    const maybePublicPath = path.resolve(config.publicFolder, pathname.slice(1))
    return !fs.existsSync(maybePublicPath)
  }

  function render404() {
    const maybe404Page = path.resolve(config.publicFolder, '404.html')
    if (fs.existsSync(maybe404Page)) {
      return fs.readFileSync(maybe404Page)
    }
    return 'Not Found'
  }

  return function(req, res, next) {
    getMatcher().then(matcher => {
      const reqUrl = new url.URL(
        req.url,
        `${req.protocol || (req.headers.scheme && req.headers.scheme + ':') || 'http:'}//${req.hostname ||
        req.headers['host']}`
      )
      const cookies = cookie.parse(req.headers.cookie || '')
      const matchReq = {
        cookies: cookies,
        scheme: reqUrl.protocol,
        host: reqUrl.hostname,
        path: reqUrl.pathname,
        query: reqUrl.search,
        getCookie: key => cookies[key] || '',
        getHeader: name =>
          ({
            'x-language': cookies.nf_lang || getLanguage(req),
            'x-country': cookies.nf_country || getCountry(req),
            ...req.headers,
          }[name.toLowerCase()]),
      }
      const match = matcher.match(matchReq)

      if (match) {
        if (match.force404) {
          res.writeHead(404)
          res.end(render404())
          return
        }

        if (match.force || notStatic(reqUrl.pathname)) {
          const dest = new url.URL(
            match.to,
            `${reqUrl.protocol}//${reqUrl.host}`
          )
          reqUrl.searchParams.forEach((v, k) => {
            dest.searchParams.append(k, v)
          })
          if (isRedirect(match)) {
            res.writeHead(match.status, {
              Location: match.to,
              'Cache-Control': 'no-cache',
            })
            res.end(`Redirecting to ${match.to}`)
            return
          }

          if (isExternal(match)) {
            console.log(`${NETLIFYDEVLOG} Proxying to `, match.to)
            const handler = proxy({
              target: `${dest.protocol}//${dest.host}`,
              changeOrigin: true,
              pathRewrite: (path, req) =>
                match.to.replace(/https?:\/\/[^\/]+/, ''),
            })
            return handler(req, res, next)
          } else {
            req.url = dest.pathname + dest.search
            console.log(`${NETLIFYDEVLOG} Rewrote URL to `, req.url)
            return next()
          }
        }
        return next()
      }

      next()
    })
  }
}
