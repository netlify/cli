// @ts-check
const { Buffer } = require('buffer')
const { readFile } = require('fs').promises
const http = require('http')
const https = require('https')
const path = require('path')

const contentType = require('content-type')
const cookie = require('cookie')
const { get } = require('dot-prop')
const httpProxy = require('http-proxy')
const { createProxyMiddleware } = require('http-proxy-middleware')
const jwtDecode = require('jwt-decode')
const locatePath = require('locate-path')
const isEmpty = require('lodash/isEmpty')
const pEvent = require('p-event')
const pFilter = require('p-filter')
const toReadableStream = require('to-readable-stream')

const { fileExistsAsync, isFileAsync } = require('../lib/fs')

const { NETLIFYDEVLOG, NETLIFYDEVWARN } = require('./command-helpers')
const { createStreamPromise } = require('./create-stream-promise')
const { headersForPath, parseHeaders } = require('./headers')
const { createRewriter, onChanges } = require('./rules-proxy')

const isInternal = function (url) {
  return url.startsWith('/.netlify/')
}
const isFunction = function (functionsPort, url) {
  return functionsPort && url.match(/^\/.netlify\/(functions|builders)\/.+/)
}

const getAddonUrl = function (addonsUrls, req) {
  const matches = req.url.match(/^\/.netlify\/([^/]+)(\/.*)/)
  const addonUrl = matches && addonsUrls[matches[1]]
  return addonUrl ? `${addonUrl}${matches[2]}` : null
}

const getStatic = async function (pathname, publicFolder) {
  const alternatives = [pathname, ...alternativePathsFor(pathname)].map((filePath) =>
    path.resolve(publicFolder, filePath.slice(1)),
  )

  const file = await locatePath(alternatives)
  if (file === undefined) {
    return false
  }

  return `/${path.relative(publicFolder, file)}`
}

const isExternal = function (match) {
  return match.to && match.to.match(/^https?:\/\//)
}

const stripOrigin = function ({ hash, pathname, search }) {
  return `${pathname}${search}${hash}`
}

const proxyToExternalUrl = function ({ dest, destURL, req, res }) {
  console.log(`${NETLIFYDEVLOG} Proxying to ${dest}`)
  const handler = createProxyMiddleware({
    target: dest.origin,
    changeOrigin: true,
    pathRewrite: () => destURL,
    ...(Buffer.isBuffer(req.originalBody) && { buffer: toReadableStream(req.originalBody) }),
  })
  return handler(req, res, {})
}

const handleAddonUrl = function ({ addonUrl, req, res }) {
  const dest = new URL(addonUrl)
  const destURL = stripOrigin(dest)

  return proxyToExternalUrl({ req, res, dest, destURL })
}

const isRedirect = function (match) {
  return match.status && match.status >= 300 && match.status <= 400
}

const render404 = async function (publicFolder) {
  const maybe404Page = path.resolve(publicFolder, '404.html')
  try {
    const isFile = await isFileAsync(maybe404Page)
    if (isFile) return await readFile(maybe404Page, 'utf-8')
  } catch (error) {
    console.warn(NETLIFYDEVWARN, 'Error while serving 404.html file', error.message)
  }

  return 'Not Found'
}

// Used as an optimization to avoid dual lookups for missing assets
const assetExtensionRegExp = /\.(html?|png|jpg|js|css|svg|gif|ico|woff|woff2)$/

const alternativePathsFor = function (url) {
  if (isFunction(true, url)) {
    return []
  }

  const paths = []
  if (url[url.length - 1] === '/') {
    const end = url.length - 1
    if (url !== '/') {
      paths.push(`${url.slice(0, end)}.html`, `${url.slice(0, end)}.htm`)
    }
    paths.push(`${url}index.html`, `${url}index.htm`)
  } else if (!assetExtensionRegExp.test(url)) {
    paths.push(`${url}.html`, `${url}.htm`, `${url}/index.html`, `${url}/index.htm`)
  }

  return paths
}

const serveRedirect = async function ({ match, options, proxy, req, res }) {
  if (!match) return proxy.web(req, res, options)

  options = options || req.proxyOptions || {}
  options.match = null

  if (!isEmpty(match.proxyHeaders)) {
    Object.entries(match.proxyHeaders).forEach(([key, value]) => {
      req.headers[key] = value
    })
  }

  if (isFunction(options.functionsPort, req.url)) {
    return proxy.web(req, res, { target: options.functionsServer })
  }
  const urlForAddons = getAddonUrl(options.addonsUrls, req)
  if (urlForAddons) {
    return handleAddonUrl({ req, res, addonUrl: urlForAddons })
  }

  const originalURL = req.url
  if (match.exceptions && match.exceptions.JWT) {
    // Some values of JWT can start with :, so, make sure to normalize them
    const expectedRoles = new Set(
      match.exceptions.JWT.split(',').map((value) => (value.startsWith(':') ? value.slice(1) : value)),
    )

    const cookieValues = cookie.parse(req.headers.cookie || '')
    const token = cookieValues.nf_jwt

    // Serve not found by default
    req.url = '/.netlify/non-existent-path'

    if (token) {
      let jwtValue = {}
      try {
        jwtValue = jwtDecode(token) || {}
      } catch (error) {
        console.warn(NETLIFYDEVWARN, 'Error while decoding JWT provided in request', error.message)
        res.writeHead(400)
        res.end('Invalid JWT provided. Please see logs for more info.')
        return
      }

      if ((jwtValue.exp || 0) < Math.round(Date.now() / MILLISEC_TO_SEC)) {
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
        if (presentedRoles.some((pr) => expectedRoles.has(pr))) {
          req.url = originalURL
        }
      }
    }
  }

  const reqUrl = reqToURL(req, req.url)

  const staticFile = await getStatic(decodeURIComponent(reqUrl.pathname), options.publicFolder)
  if (staticFile) {
    req.url = encodeURIComponent(staticFile) + reqUrl.search
    // if there is an existing static file and it is not a forced redirect, return the file
    if (!match.force) {
      return proxy.web(req, res, { ...options, staticFile })
    }
  }
  if (match.force404) {
    res.writeHead(404)
    res.end(await render404(options.publicFolder))
    return
  }

  if (match.force || !staticFile || !options.framework || req.method === 'POST') {
    // construct destination URL from redirect rule match
    const dest = new URL(match.to, `${reqUrl.protocol}//${reqUrl.host}`)

    // We pass through request params in one of the following cases:
    // 1. The redirect rule doesn't have any query params
    // 2. This is a function redirect https://github.com/netlify/cli/issues/1605
    if ([...dest.searchParams].length === 0 || isFunction(options.functionsPort, stripOrigin(dest))) {
      dest.searchParams.forEach((_, key) => {
        dest.searchParams.delete(key)
      })

      const requestParams = new URLSearchParams(reqUrl.searchParams)
      requestParams.forEach((val, key) => {
        dest.searchParams.append(key, val)
      })
    }

    const destURL = stripOrigin(dest)

    if (isExternal(match)) {
      return proxyToExternalUrl({ req, res, dest, destURL })
    }

    if (isRedirect(match)) {
      res.writeHead(match.status, {
        Location: destURL,
        'Cache-Control': 'no-cache',
      })
      res.end(`Redirecting to ${destURL}`)
      return
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
    let statusValue
    if (match.force || (!staticFile && ((!options.framework && destStaticFile) || isInternal(destURL)))) {
      req.url = destStaticFile ? destStaticFile + dest.search : destURL
      const { status } = match
      statusValue = status
      console.log(`${NETLIFYDEVLOG} Rewrote URL to`, req.url)
    }

    if (isFunction(options.functionsPort, req.url)) {
      req.headers['x-netlify-original-pathname'] = reqToURL(req, originalURL).pathname
      return proxy.web(req, res, { target: options.functionsServer })
    }
    const addonUrl = getAddonUrl(options.addonsUrls, req)
    if (addonUrl) {
      return handleAddonUrl({ req, res, addonUrl })
    }

    return proxy.web(req, res, { ...options, status: statusValue })
  }

  return proxy.web(req, res, options)
}

const reqToURL = function (req, pathname) {
  return new URL(
    pathname,
    `${req.protocol || (req.headers.scheme && `${req.headers.scheme}:`) || 'http:'}//${
      req.headers.host || req.hostname
    }`,
  )
}

const MILLISEC_TO_SEC = 1e3

const initializeProxy = async function ({ configPath, distDir, port, projectDir }) {
  const proxy = httpProxy.createProxyServer({
    selfHandleResponse: true,
    target: {
      host: 'localhost',
      port,
    },
  })

  const headersFiles = [...new Set([path.resolve(projectDir, '_headers'), path.resolve(distDir, '_headers')])]

  let headers = await parseHeaders({ headersFiles, configPath })

  const watchedHeadersFiles = configPath === undefined ? headersFiles : [...headersFiles, configPath]
  onChanges(watchedHeadersFiles, async () => {
    const existingHeadersFiles = await pFilter(watchedHeadersFiles, fileExistsAsync)
    console.log(
      `${NETLIFYDEVLOG} Reloading headers files from`,
      existingHeadersFiles.map((headerFile) => path.relative(projectDir, headerFile)),
    )
    headers = await parseHeaders({ headersFiles, configPath })
  })

  proxy.before('web', 'stream', (req) => {
    // See https://github.com/http-party/node-http-proxy/issues/1219#issuecomment-511110375
    if (req.headers.expect) {
      // eslint-disable-next-line no-underscore-dangle
      req.__expectHeader = req.headers.expect
      delete req.headers.expect
    }
  })

  proxy.on('error', (err) => console.error('error while proxying request:', err.message))
  proxy.on('proxyReq', (proxyReq, req) => {
    // eslint-disable-next-line no-underscore-dangle
    if (req.__expectHeader) {
      // eslint-disable-next-line no-underscore-dangle
      proxyReq.setHeader('Expect', req.__expectHeader)
    }
    if (req.originalBody) {
      proxyReq.write(req.originalBody)
    }
  })
  proxy.on('proxyRes', (proxyRes, req, res) => {
    if (proxyRes.statusCode === 404 || proxyRes.statusCode === 403) {
      if (req.alternativePaths && req.alternativePaths.length !== 0) {
        req.url = req.alternativePaths.shift()
        return proxy.web(req, res, req.proxyOptions)
      }
      if (req.proxyOptions && req.proxyOptions.match) {
        return serveRedirect({ req, res, proxy: handlers, match: req.proxyOptions.match, options: req.proxyOptions })
      }
    }

    if (req.proxyOptions.staticFile && isRedirect({ status: proxyRes.statusCode }) && proxyRes.headers.location) {
      req.url = proxyRes.headers.location
      return serveRedirect({ req, res, proxy: handlers, match: null, options: req.proxyOptions })
    }

    const requestURL = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    const headersRules = headersForPath(headers, requestURL.pathname)
    Object.entries(headersRules).forEach(([key, val]) => {
      res.setHeader(key, val)
    })
    res.writeHead(req.proxyOptions.status || proxyRes.statusCode, proxyRes.headers)
    proxyRes.on('data', function onData(data) {
      res.write(data)
    })
    proxyRes.on('end', function onEnd() {
      res.end()
    })
  })

  const handlers = {
    web: (req, res, options) => {
      const requestURL = new URL(req.url, 'http://localhost')
      req.proxyOptions = options
      req.alternativePaths = alternativePathsFor(requestURL.pathname).map((filePath) => filePath + requestURL.search)
      // Ref: https://nodejs.org/api/net.html#net_socket_remoteaddress
      req.headers['x-forwarded-for'] = req.connection.remoteAddress || ''
      return proxy.web(req, res, options)
    },
    ws: (req, socket, head) => proxy.ws(req, socket, head),
  }

  return handlers
}

const onRequest = async ({ addonsUrls, functionsServer, proxy, rewriter, settings }, req, res) => {
  req.originalBody = ['GET', 'OPTIONS', 'HEAD'].includes(req.method)
    ? null
    : await createStreamPromise(req, BYTES_LIMIT)

  if (isFunction(settings.functionsPort, req.url)) {
    return proxy.web(req, res, { target: functionsServer })
  }
  const addonUrl = getAddonUrl(addonsUrls, req)
  if (addonUrl) {
    return handleAddonUrl({ req, res, addonUrl })
  }

  const match = await rewriter(req)
  const options = {
    match,
    addonsUrls,
    target: `http://localhost:${settings.frameworkPort}`,
    publicFolder: settings.dist,
    functionsServer,
    functionsPort: settings.functionsPort,
    jwtRolePath: settings.jwtRolePath,
    framework: settings.framework,
  }

  if (match) return serveRedirect({ req, res, proxy, match, options })

  const ct = req.headers['content-type'] ? contentType.parse(req).type : ''
  if (
    functionsServer &&
    req.method === 'POST' &&
    !isInternal(req.url) &&
    (ct.endsWith('/x-www-form-urlencoded') || ct === 'multipart/form-data')
  ) {
    return proxy.web(req, res, { target: functionsServer })
  }

  proxy.web(req, res, options)
}

const startProxy = async function (settings, addonsUrls, configPath, projectDir) {
  const functionsServer = settings.functionsPort ? `http://localhost:${settings.functionsPort}` : null

  const proxy = await initializeProxy({
    port: settings.frameworkPort,
    distDir: settings.dist,
    projectDir,
    configPath,
  })

  const rewriter = await createRewriter({
    distDir: settings.dist,
    projectDir,
    jwtSecret: settings.jwtSecret,
    jwtRoleClaim: settings.jwtRolePath,
    configPath,
  })

  const onRequestWithOptions = onRequest.bind(undefined, { proxy, rewriter, settings, addonsUrls, functionsServer })
  const server = settings.https
    ? https.createServer({ cert: settings.https.cert, key: settings.https.key }, onRequestWithOptions)
    : http.createServer(onRequestWithOptions)

  server.on('upgrade', function onUpgrade(req, socket, head) {
    proxy.ws(req, socket, head)
  })

  server.listen({ port: settings.port })
  // TODO: use events.once when we drop support for Node.js < 12
  await pEvent(server, 'listening')

  const scheme = settings.https ? 'https' : 'http'
  return `${scheme}://localhost:${settings.port}`
}

const BYTES_LIMIT = 30

module.exports = { startProxy }
