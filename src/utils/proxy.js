const { Buffer } = require('buffer')
const http = require('http')
const path = require('path')
const { URL, URLSearchParams } = require('url')

const contentType = require('content-type')
const cookie = require('cookie')
const httpProxy = require('http-proxy')
const { createProxyMiddleware } = require('http-proxy-middleware')
const jwtDecode = require('jwt-decode')
const locatePath = require('locate-path')
const get = require('lodash/get')
const isEmpty = require('lodash/isEmpty')
const pFilter = require('p-filter')
const toReadableStream = require('to-readable-stream')

const { readFileAsync, fileExistsAsync, isFileAsync } = require('../lib/fs.js')

const { createStreamPromise } = require('./create-stream-promise')
const { parseHeadersFile, objectForPath } = require('./headers')
const { NETLIFYDEVLOG, NETLIFYDEVWARN } = require('./logo')
const { createRewriter } = require('./rules-proxy')
const { onChanges } = require('./rules-proxy')

const isInternal = function (url) {
  return url.startsWith('/.netlify/')
}
const isFunction = function (functionsPort, url) {
  return functionsPort && url.match(/^\/.netlify\/functions\/.+/)
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

const stripOrigin = function ({ pathname, search, hash }) {
  return `${pathname}${search}${hash}`
}

const proxyToExternalUrl = function ({ req, res, dest, destURL }) {
  console.log(`${NETLIFYDEVLOG} Proxying to ${dest}`)
  const handler = createProxyMiddleware({
    target: dest.origin,
    changeOrigin: true,
    pathRewrite: () => destURL,
    ...(Buffer.isBuffer(req.originalBody) && { buffer: toReadableStream(req.originalBody) }),
  })
  return handler(req, res, {})
}

const handleAddonUrl = function ({ req, res, addonUrl }) {
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
    if (isFile) return await readFileAsync(maybe404Page)
  } catch (error) {
    console.warn(NETLIFYDEVWARN, 'Error while serving 404.html file', error.message)
  }

  return 'Not Found'
}

// Used as an optimization to avoid dual lookups for missing assets
const assetExtensionRegExp = /\.(html?|png|jpg|js|css|svg|gif|ico|woff|woff2)$/

const alternativePathsFor = function (url) {
  const paths = []
  if (url[url.length - 1] === '/') {
    const end = url.length - 1
    if (url !== '/') {
      paths.push(`${url.slice(0, end)}.html`)
      paths.push(`${url.slice(0, end)}.htm`)
    }
    paths.push(`${url}index.html`)
    paths.push(`${url}index.htm`)
  } else if (!url.match(assetExtensionRegExp)) {
    paths.push(`${url}.html`)
    paths.push(`${url}.htm`)
    paths.push(`${url}/index.html`)
    paths.push(`${url}/index.htm`)
  }

  return paths
}

const serveRedirect = async function ({ req, res, proxy, match, options }) {
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

  if (match.exceptions && match.exceptions.JWT) {
    // Some values of JWT can start with :, so, make sure to normalize them
    const expectedRoles = new Set(
      match.exceptions.JWT.split(',').map((value) => (value.startsWith(':') ? value.slice(1) : value)),
    )

    const cookieValues = cookie.parse(req.headers.cookie || '')
    const token = cookieValues.nf_jwt

    // Serve not found by default
    const originalURL = req.url
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

  const reqUrl = new URL(
    req.url,
    `${req.protocol || (req.headers.scheme && `${req.headers.scheme}:`) || 'http:'}//${
      req.headers.host || req.hostname
    }`,
  )

  const staticFile = await getStatic(decodeURIComponent(reqUrl.pathname), options.publicFolder)
  if (staticFile) req.url = staticFile + reqUrl.search
  if (match.force404) {
    res.writeHead(404)
    res.end(await render404(options.publicFolder))
    return
  }

  if (match.force || !staticFile || !options.framework || req.method === 'POST') {
    const dest = new URL(match.to, `${reqUrl.protocol}//${reqUrl.host}`)

    // Use query params of request URL as base, so that, destination query params can supersede
    const urlParams = new URLSearchParams(reqUrl.searchParams)
    dest.searchParams.forEach((val, key) => {
      urlParams.set(key, val)
    })
    urlParams.forEach((val, key) => {
      dest.searchParams.set(key, val)
    })

    const destURL = stripOrigin(dest)

    if (isRedirect(match)) {
      res.writeHead(match.status, {
        Location: match.to,
        'Cache-Control': 'no-cache',
      })
      res.end(`Redirecting to ${match.to}`)
      return
    }

    if (isExternal(match)) {
      return proxyToExternalUrl({ req, res, dest, destURL })
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
      req.headers['x-netlify-original-pathname'] = reqUrl.pathname
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

const MILLISEC_TO_SEC = 1e3

const initializeProxy = function (port, distDir, projectDir) {
  const proxy = httpProxy.createProxyServer({
    selfHandleResponse: true,
    target: {
      host: 'localhost',
      port,
    },
  })

  const headersFiles = [...new Set([path.resolve(projectDir, '_headers'), path.resolve(distDir, '_headers')])]

  let headerRules = headersFiles.reduce((prev, curr) => Object.assign(prev, parseHeadersFile(curr)), {})
  onChanges(headersFiles, async () => {
    console.log(
      `${NETLIFYDEVLOG} Reloading headers files`,
      (await pFilter(headersFiles, fileExistsAsync)).map((headerFile) => path.relative(projectDir, headerFile)),
    )
    headerRules = headersFiles.reduce((prev, curr) => Object.assign(prev, parseHeadersFile(curr)), {})
  })

  proxy.on('error', (err) => console.error('error while proxying request:', err.message))
  proxy.on('proxyReq', (proxyReq, req) => {
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
    const requestURL = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    const pathHeaderRules = objectForPath(headerRules, requestURL.pathname)
    if (!isEmpty(pathHeaderRules)) {
      Object.entries(pathHeaderRules).forEach(([key, val]) => {
        res.setHeader(key, val)
      })
    }
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

const startProxy = async function (settings, addonsUrls, configPath, projectDir) {
  const functionsServer = settings.functionsPort ? `http://localhost:${settings.functionsPort}` : null

  const proxy = initializeProxy(settings.frameworkPort, settings.dist, projectDir)

  const rewriter = await createRewriter({
    distDir: settings.dist,
    jwtSecret: settings.jwtSecret,
    jwtRoleClaim: settings.jwtRolePath,
    configPath,
    projectDir,
  })

  const server = http.createServer(async function onRequest(req, res) {
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
      req.method === 'POST' &&
      !isInternal(req.url) &&
      (ct.endsWith('/x-www-form-urlencoded') || ct === 'multipart/form-data')
    ) {
      return proxy.web(req, res, { target: functionsServer })
    }

    proxy.web(req, res, options)
  })

  server.on('upgrade', function onUpgrade(req, socket, head) {
    proxy.ws(req, socket, head)
  })

  return new Promise((resolve) => {
    server.listen({ port: settings.port }, () => {
      resolve(`http://localhost:${settings.port}`)
    })
  })
}

const BYTES_LIMIT = 30

module.exports = { startProxy }
