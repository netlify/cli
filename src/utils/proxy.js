const path = require('path')
const http = require('http')
const fs = require('fs-extra')
const url = require('url')
const httpProxy = require('http-proxy')
const { createProxyMiddleware } = require('http-proxy-middleware')
const cookie = require('cookie')
const get = require('lodash.get')
const isEmpty = require('lodash.isempty')
const jwtDecode = require('jwt-decode')
const contentType = require('content-type')
const toReadableStream = require('to-readable-stream')
const { createRewriter } = require('./rules-proxy')
const { createStreamPromise } = require('./create-stream-promise')
const { onChanges } = require('./rules-proxy')
const { parseHeadersFile, objectForPath } = require('./headers')
const { NETLIFYDEVLOG, NETLIFYDEVWARN } = require('./logo')

function isInternal(url) {
  return url.startsWith('/.netlify/')
}
function isFunction(functionsPort, url) {
  return functionsPort && url.match(/^\/.netlify\/functions\/.+/)
}

function addonUrl(addonUrls, req) {
  const m = req.url.match(/^\/.netlify\/([^\/]+)(\/.*)/) // eslint-disable-line no-useless-escape
  const addonUrl = m && addonUrls[m[1]]
  return addonUrl ? `${addonUrl}${m[2]}` : null
}

async function getStatic(pathname, publicFolder) {
  const alternatives = [pathname, ...alternativePathsFor(pathname)].map(p => path.resolve(publicFolder, p.substr(1)))

  for (const i in alternatives) {
    const p = alternatives[i]
    try {
      const pathStats = await fs.stat(p)
      if (pathStats.isFile()) return '/' + path.relative(publicFolder, p)
    } catch (err) {
      // Ignore
    }
  }
  return false
}

function isExternal(match) {
  return match.to && match.to.match(/^https?:\/\//)
}

function isRedirect(match) {
  return match.status && match.status >= 300 && match.status <= 400
}

function render404(publicFolder) {
  const maybe404Page = path.resolve(publicFolder, '404.html')
  if (fs.existsSync(maybe404Page)) return fs.readFileSync(maybe404Page)
  return 'Not Found'
}

// Used as an optimization to avoid dual lookups for missing assets
const assetExtensionRegExp = /\.(html?|png|jpg|js|css|svg|gif|ico|woff|woff2)$/

function alternativePathsFor(url) {
  const paths = []
  if (url[url.length - 1] === '/') {
    const end = url.length - 1
    if (url !== '/') {
      paths.push(url.slice(0, end) + '.html')
      paths.push(url.slice(0, end) + '.htm')
    }
    paths.push(url + 'index.html')
    paths.push(url + 'index.htm')
  } else if (!url.match(assetExtensionRegExp)) {
    paths.push(url + '.html')
    paths.push(url + '.htm')
    paths.push(url + '/index.html')
    paths.push(url + '/index.htm')
  }

  return paths
}

async function serveRedirect(req, res, proxy, match, options) {
  if (!match) return proxy.web(req, res, options)

  options = options || req.proxyOptions || {}
  options.match = null

  if (!isEmpty(match.proxyHeaders)) {
    Object.entries(match.proxyHeaders).forEach(([k, v]) => (req.headers[k] = v))
  }

  if (isFunction(options.functionsPort, req.url)) {
    return proxy.web(req, res, { target: options.functionsServer })
  }
  const urlForAddons = addonUrl(options.addonUrls, req)
  if (urlForAddons) {
    return proxy.web(req, res, { target: urlForAddons })
  }

  if (match.exceptions && match.exceptions.JWT) {
    // Some values of JWT can start with :, so, make sure to normalize them
    const expectedRoles = match.exceptions.JWT.split(',').map(r => (r.startsWith(':') ? r.slice(1) : r))

    const cookieValues = cookie.parse(req.headers.cookie || '')
    const token = cookieValues['nf_jwt']

    // Serve not found by default
    const originalURL = req.url
    req.url = '/.netlify/non-existent-path'

    if (token) {
      let jwtValue = {}
      try {
        jwtValue = jwtDecode(token) || {}
      } catch (err) {
        console.warn(NETLIFYDEVWARN, 'Error while decoding JWT provided in request', err.message)
        res.writeHead(400)
        res.end('Invalid JWT provided. Please see logs for more info.')
        return
      }

      if ((jwtValue.exp || 0) < Math.round(new Date().getTime() / 1000)) {
        console.warn(NETLIFYDEVWARN, 'Expired JWT provided in request', req.url)
      } else {
        const presentedRoles = get(jwtValue, options.jwtRolePath) || []
        if (!Array.isArray(presentedRoles)) {
          console.warn(NETLIFYDEVWARN, `Invalid roles value provided in JWT ${options.jwtRolePath}`, presentedRoles)
          res.writeHead(400)
          res.end('Invalid JWT provided. Please see logs for more info.')
          return
        }

        // Restore the URL if everything is correct
        if (presentedRoles.some(pr => expectedRoles.includes(pr))) {
          req.url = originalURL
        }
      }
    }
  }

  const reqUrl = new url.URL(
    req.url,
    `${req.protocol || (req.headers.scheme && req.headers.scheme + ':') || 'http:'}//${req.headers['host'] ||
      req.hostname}`
  )

  const staticFile = await getStatic(reqUrl.pathname, options.publicFolder)
  if (staticFile) req.url = staticFile + reqUrl.search
  if (match.force404) {
    res.writeHead(404)
    return render404(options.publicFolder)
  }

  if (match.force || !staticFile || !options.framework || req.method === 'POST') {
    const dest = new url.URL(match.to, `${reqUrl.protocol}//${reqUrl.host}`)

    // Use query params of request URL as base, so that, destination query params can supersede
    const urlParams = new url.URLSearchParams(reqUrl.searchParams)
    dest.searchParams.forEach((val, key) => urlParams.set(key, val))
    urlParams.forEach((val, key) => dest.searchParams.set(key, val))

    // Get the URL after http://host:port
    const destURL = dest.toString().replace(dest.origin, '')

    if (isRedirect(match)) {
      res.writeHead(match.status, {
        'Location': match.to,
        'Cache-Control': 'no-cache',
      })
      res.end(`Redirecting to ${match.to}`)
      return
    }

    if (isExternal(match)) {
      console.log(`${NETLIFYDEVLOG} Proxying to `, dest.toString())
      const handler = createProxyMiddleware({
        target: `${dest.protocol}//${dest.host}`,
        changeOrigin: true,
        pathRewrite: (path, req) => destURL.replace(/https?:\/\/[^/]+/, ''),
        ...(Buffer.isBuffer(req.originalBody) && { buffer: toReadableStream(req.originalBody) }),
      })
      return handler(req, res, {})
    }

    const ct = req.headers['content-type'] ? contentType.parse(req).type : ''
    if (
      req.method === 'POST' &&
      !isInternal(req.url) &&
      !isInternal(destURL) &&
      (ct.endsWith('/x-www-form-urlencoded') || ct === 'multipart/form-data')
    ) {
      return proxy.web(req, res, { target: options.functionsServer })
    }

    const destStaticFile = await getStatic(dest.pathname, options.publicFolder)
    let status
    if (match.force || (!staticFile && ((!options.framework && destStaticFile) || isInternal(destURL)))) {
      req.url = destStaticFile ? destStaticFile + dest.search : destURL
      status = match.status
      console.log(`${NETLIFYDEVLOG} Rewrote URL to`, req.url)
    }

    if (isFunction(options.functionsPort, req.url)) {
      req.headers['x-netlify-original-pathname'] = reqUrl.pathname
      return proxy.web(req, res, { target: options.functionsServer })
    }
    const urlForAddons = addonUrl(options.addonUrls, req)
    if (urlForAddons) {
      return proxy.web(req, res, { target: urlForAddons })
    }

    return proxy.web(req, res, { ...options, status })
  }

  return proxy.web(req, res, options)
}

function initializeProxy(port, distDir, projectDir) {
  const proxy = httpProxy.createProxyServer({
    selfHandleResponse: true,
    target: {
      host: 'localhost',
      port,
    },
  })

  const headersFiles = Array.from(new Set([path.resolve(projectDir, '_headers'), path.resolve(distDir, '_headers')]))

  let headerRules = headersFiles.reduce((prev, curr) => Object.assign(prev, parseHeadersFile(curr)), {})
  onChanges(headersFiles, () => {
    console.log(
      `${NETLIFYDEVLOG} Reloading headers files`,
      headersFiles.filter(fs.existsSync).map(p => path.relative(projectDir, p))
    )
    headerRules = headersFiles.reduce((prev, curr) => Object.assign(prev, parseHeadersFile(curr)), {})
  })

  proxy.on('error', err => console.error('error while proxying request:', err.message))
  proxy.on('proxyReq', (proxyReq, req) => {
    if (req.originalBody) {
      proxyReq.write(req.originalBody)
    }
  })
  proxy.on('proxyRes', (proxyRes, req, res) => {
    if (proxyRes.statusCode === 404 || proxyRes.statusCode === 403) {
      if (req.alternativePaths && req.alternativePaths.length > 0) {
        req.url = req.alternativePaths.shift()
        return proxy.web(req, res, req.proxyOptions)
      }
      if (req.proxyOptions && req.proxyOptions.match) {
        return serveRedirect(req, res, handlers, req.proxyOptions.match, req.proxyOptions)
      }
    }
    const requestURL = new url.URL(req.url, `http://${req.headers.host || 'localhost'}`)
    const pathHeaderRules = objectForPath(headerRules, requestURL.pathname)
    if (!isEmpty(pathHeaderRules)) {
      Object.entries(pathHeaderRules).forEach(([key, val]) => res.setHeader(key, val))
    }
    res.writeHead(req.proxyOptions.status || proxyRes.statusCode, proxyRes.headers)
    proxyRes.on('data', function(data) {
      res.write(data)
    })
    proxyRes.on('end', function() {
      res.end()
    })
  })

  const handlers = {
    web: (req, res, options) => {
      const requestURL = new url.URL(req.url, 'http://localhost')
      req.proxyOptions = options
      req.alternativePaths = alternativePathsFor(requestURL.pathname).map(p => p + requestURL.search)
      // Ref: https://nodejs.org/api/net.html#net_socket_remoteaddress
      req.headers['x-forwarded-for'] = req.connection.remoteAddress || ''
      return proxy.web(req, res, options)
    },
    ws: (req, socket, head) => proxy.ws(req, socket, head),
  }

  return handlers
}

async function startProxy(settings = {}, addonUrls, configPath, projectDir) {
  const functionsServer = settings.functionsPort ? `http://localhost:${settings.functionsPort}` : null

  const proxy = initializeProxy(settings.frameworkPort, settings.dist, projectDir)

  const rewriter = await createRewriter({
    distDir: settings.dist,
    jwtRole: settings.jwtRolePath,
    configPath,
    projectDir,
  })

  const server = http.createServer(async function(req, res) {
    req.originalBody = ['GET', 'OPTIONS', 'HEAD'].includes(req.method) ? null : await createStreamPromise(req, 30)

    if (isFunction(settings.functionsPort, req.url)) {
      return proxy.web(req, res, { target: functionsServer })
    }
    const urlForAddons = addonUrl(addonUrls, req)
    if (urlForAddons) {
      return proxy.web(req, res, { target: urlForAddons })
    }

    rewriter(req, res, match => {
      const options = {
        match,
        addonUrls,
        target: `http://localhost:${settings.frameworkPort}`,
        publicFolder: settings.dist,
        functionsServer,
        functionsPort: settings.functionsPort,
        jwtRolePath: settings.jwtRolePath,
        framework: settings.framework,
      }

      if (match) return serveRedirect(req, res, proxy, match, options)

      const ct = req.headers['content-type'] ? contentType.parse(req).type : ''
      if (
        req.method === 'POST' &&
        !isInternal(req.url) &&
        (ct.endsWith('/x-www-form-urlencoded') || ct === 'multipart/form-data')
      ) {
        return proxy.web(req, res, { target: functionsServer })
      }

      proxy.web(req, res, options)
    })
  })

  server.on('upgrade', function(req, socket, head) {
    proxy.ws(req, socket, head)
  })

  return new Promise(resolve => {
    server.listen({ port: settings.port }, () => {
      resolve(`http://localhost:${settings.port}`)
    })
  })
}

module.exports = { startProxy }
