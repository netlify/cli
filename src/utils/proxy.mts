// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'Buffer'.
const { Buffer } = require('buffer')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'once'.
const { once } = require('events')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'readFile'.
const { readFile } = require('fs').promises
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'http'.
const http = require('http')
const https = require('https')
const { isIPv6 } = require('net')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'path'.
const path = require('path')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'util'.
const util = require('util')
const zlib = require('zlib')

const contentType = require('content-type')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'cookie'.
const cookie = require('cookie')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'get'.
const { get } = require('dot-prop')
const generateETag = require('etag')
const httpProxy = require('http-proxy')
const { createProxyMiddleware } = require('http-proxy-middleware')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'jwtDecode'... Remove this comment to see the full error message
const jwtDecode = require('jwt-decode')
const locatePath = require('locate-path')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'isEmpty'.
const isEmpty = require('lodash/isEmpty')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'pFilter'.
const pFilter = require('p-filter')
const toReadableStream = require('to-readable-stream')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'edgeFuncti... Remove this comment to see the full error message
const edgeFunctions = require('../lib/edge-functions/index.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'fileExists... Remove this comment to see the full error message
const { fileExistsAsync, isFileAsync } = require('../lib/fs.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'renderErro... Remove this comment to see the full error message
const renderErrorTemplate = require('../lib/render-error-remplate.cjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'NETLIFYDEV... Remove this comment to see the full error message
const { NETLIFYDEVLOG, NETLIFYDEVWARN } = require('./command-helpers.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createStre... Remove this comment to see the full error message
const { createStreamPromise } = require('./create-stream-promise.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'headersFor... Remove this comment to see the full error message
const { headersForPath, parseHeaders } = require('./headers.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createRewr... Remove this comment to see the full error message
const { createRewriter, onChanges } = require('./rules-proxy.cjs')

const decompress = util.promisify(zlib.gunzip)
const shouldGenerateETag = Symbol('Internal: response should generate ETag')

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const formatEdgeFunctionError = (errorBuffer: $TSFixMe, acceptsHtml: $TSFixMe) => {
  const {
    error: { message, name, stack },
  } = JSON.parse(errorBuffer.toString())

  if (!acceptsHtml) {
    return `${name}: ${message}\n ${stack}`
  }

  return JSON.stringify({
    errorType: name,
    errorMessage: message,
    trace: stack.split('\\n'),
  })
}

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const isInternal = function (url: $TSFixMe) {
  return url.startsWith('/.netlify/')
}
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const isFunction = function (functionsPort: $TSFixMe, url: $TSFixMe) {
  return functionsPort && url.match(/^\/.netlify\/(functions|builders)\/.+/);
}

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const getAddonUrl = function (addonsUrls: $TSFixMe, req: $TSFixMe) {
  const matches = req.url.match(/^\/.netlify\/([^/]+)(\/.*)/)
  const addonUrl = matches && addonsUrls[matches[1]]
  return addonUrl ? `${addonUrl}${matches[2]}` : null
}

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const getStatic = async function (pathname: $TSFixMe, publicFolder: $TSFixMe) {
  const alternatives = [pathname, ...alternativePathsFor(pathname)].map((filePath) =>
    path.resolve(publicFolder, filePath.slice(1)),
  )

  const file = await locatePath(alternatives)
  if (file === undefined) {
    return false
  }

  return `/${path.relative(publicFolder, file)}`
}

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const isExternal = function (match: $TSFixMe) {
  return match.to && match.to.match(/^https?:\/\//);
}

const stripOrigin = function ({
  hash,
  pathname,
  search
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) {
  return `${pathname}${search}${hash}`
}

const proxyToExternalUrl = function ({
  dest,
  destURL,
  req,
  res
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) {
  console.log(`${NETLIFYDEVLOG} Proxying to ${dest}`)
  const handler = createProxyMiddleware({
    target: dest.origin,
    changeOrigin: true,
    pathRewrite: () => destURL,
    ...(Buffer.isBuffer(req.originalBody) && { buffer: toReadableStream(req.originalBody) }),
  })
  return handler(req, res, () => {})
}

const handleAddonUrl = function ({
  addonUrl,
  req,
  res
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) {
  const dest = new URL(addonUrl)
  const destURL = stripOrigin(dest)

  return proxyToExternalUrl({ req, res, dest, destURL })
}

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const isRedirect = function (match: $TSFixMe) {
  return match.status && match.status >= 300 && match.status <= 400
}

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const render404 = async function (publicFolder: $TSFixMe) {
  const maybe404Page = path.resolve(publicFolder, '404.html')
  try {
    const isFile = await isFileAsync(maybe404Page)
    if (isFile) return await readFile(maybe404Page, 'utf-8')
  } catch (error) {
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    console.warn(NETLIFYDEVWARN, 'Error while serving 404.html file', (error as $TSFixMe).message);
  }

  return 'Not Found'
}

// Used as an optimization to avoid dual lookups for missing assets
const assetExtensionRegExp = /\.(html?|png|jpg|js|css|svg|gif|ico|woff|woff2)$/

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const alternativePathsFor = function (url: $TSFixMe) {
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

const serveRedirect = async function ({
  match,
  options,
  proxy,
  req,
  res
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) {
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
      // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
      match.exceptions.JWT.split(',').map((value: $TSFixMe) => value.startsWith(':') ? value.slice(1) : value),
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
        // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
        console.warn(NETLIFYDEVWARN, 'Error while decoding JWT provided in request', (error as $TSFixMe).message);
        res.writeHead(400)
        res.end('Invalid JWT provided. Please see logs for more info.')
        return
      }

      // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
      if (((jwtValue as $TSFixMe).exp || 0) < Math.round(Date.now() / MILLISEC_TO_SEC)) {
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
    req.url = encodeURI(staticFile) + reqUrl.search
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

    // We pass through request params if the redirect rule
    // doesn't have any query params
    if ([...dest.searchParams].length === 0) {
      dest.searchParams.forEach((_, key) => {
        dest.searchParams.delete(key)
      })

      const requestParams = new URLSearchParams(reqUrl.searchParams)
      requestParams.forEach((val, key) => {
        dest.searchParams.append(key, val)
      })
    }

    let destURL = stripOrigin(dest)

    if (isExternal(match)) {
      if (isRedirect(match)) {
        // This is a redirect, so we set the complete external URL as destination
        destURL = `${dest}`
      } else {
        return proxyToExternalUrl({ req, res, dest, destURL })
      }
    }

    if (isRedirect(match)) {
      console.log(`${NETLIFYDEVLOG} Redirecting ${req.url} to ${destURL}`)
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

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const reqToURL = function (req: $TSFixMe, pathname: $TSFixMe) {
  return new URL(
    pathname,
    `${req.protocol || (req.headers.scheme && `${req.headers.scheme}:`) || 'http:'}//${
      req.headers.host || req.hostname
    }`,
  )
}

const MILLISEC_TO_SEC = 1e3

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'initialize... Remove this comment to see the full error message
const initializeProxy = async function ({
  configPath,
  distDir,
  host,
  port,
  projectDir
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) {
  const proxy = httpProxy.createProxyServer({
    selfHandleResponse: true,
    target: {
      host,
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
      // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
      existingHeadersFiles.map((headerFile: $TSFixMe) => path.relative(projectDir, headerFile)),
    )
    headers = await parseHeaders({ headersFiles, configPath })
  })

  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  proxy.before('web', 'stream', (req: $TSFixMe) => {
    // See https://github.com/http-party/node-http-proxy/issues/1219#issuecomment-511110375
    if (req.headers.expect) {
      // eslint-disable-next-line no-underscore-dangle
      req.__expectHeader = req.headers.expect
      delete req.headers.expect
    }
  })

  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  proxy.on('error', (_: $TSFixMe, req: $TSFixMe, res: $TSFixMe) => {
    res.writeHead(500, {
      'Content-Type': 'text/plain',
    })

    const message = edgeFunctions.isEdgeFunctionsRequest(req)
      ? 'There was an error with an Edge Function. Please check the terminal for more details.'
      : 'Could not proxy request.'

    res.end(message)
  })
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  proxy.on('proxyReq', (proxyReq: $TSFixMe, req: $TSFixMe) => {
    if (edgeFunctions.isEdgeFunctionsRequest(req)) {
      edgeFunctions.handleProxyRequest(req, proxyReq)
    }

    // eslint-disable-next-line no-underscore-dangle
    if (req.__expectHeader) {
      // eslint-disable-next-line no-underscore-dangle
      proxyReq.setHeader('Expect', req.__expectHeader)
    }
    if (req.originalBody) {
      proxyReq.write(req.originalBody)
    }
  })
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  proxy.on('proxyRes', (proxyRes: $TSFixMe, req: $TSFixMe, res: $TSFixMe) => {
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

    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    const responseData: $TSFixMe = []
    const requestURL = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`)
    const headersRules = headersForPath(headers, requestURL.pathname)

    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    proxyRes.on('data', function onData(data: $TSFixMe) {
      responseData.push(data)
    })

    proxyRes.on('end', async function onEnd() {
      const responseBody = Buffer.concat(responseData)

      let responseStatus = req.proxyOptions.status || proxyRes.statusCode

      // `req[shouldGenerateETag]` may contain a function that determines
      // whether the response should have an ETag header.
      if (
        typeof req[shouldGenerateETag] === 'function' &&
        req[shouldGenerateETag]({ statusCode: responseStatus }) === true
      ) {
        const etag = generateETag(responseBody, { weak: true })

        if (req.headers['if-none-match'] === etag) {
          responseStatus = 304
        }

        res.setHeader('etag', etag)
      }

      Object.entries(headersRules).forEach(([key, val]) => {
        res.setHeader(key, val)
      })

      const isUncaughtError = proxyRes.headers['x-nf-uncaught-error'] === '1'

      if (edgeFunctions.isEdgeFunctionsRequest(req) && isUncaughtError) {
        const acceptsHtml = req.headers && req.headers.accept && req.headers.accept.includes('text/html')
        const decompressedBody = await decompress(responseBody)
        const formattedBody = formatEdgeFunctionError(decompressedBody, acceptsHtml)
        const errorResponse = acceptsHtml
          ? await renderErrorTemplate(formattedBody, './templates/function-error.html', 'edge function')
          : formattedBody
        const contentLength = Buffer.from(errorResponse, 'utf8').byteLength

        res.setHeader('content-length', contentLength)
        res.write(errorResponse)
        return res.end()
      }

      res.writeHead(responseStatus, proxyRes.headers)

      if (responseStatus !== 304) {
        res.write(responseBody)
      }

      res.end()
    })
  })

  const handlers = {
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    web: (req: $TSFixMe, res: $TSFixMe, options: $TSFixMe) => {
      const requestURL = new URL(req.url, 'http://127.0.0.1')
      req.proxyOptions = options
      req.alternativePaths = alternativePathsFor(requestURL.pathname).map((filePath) => filePath + requestURL.search)
      // Ref: https://nodejs.org/api/net.html#net_socket_remoteaddress
      req.headers['x-forwarded-for'] = req.connection.remoteAddress || ''
      return proxy.web(req, res, options)
    },
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    ws: (req: $TSFixMe, socket: $TSFixMe, head: $TSFixMe) => proxy.ws(req, socket, head),
  }

  return handlers
}

const onRequest = async ({
  addonsUrls,
  edgeFunctionsProxy,
  functionsServer,
  proxy,
  rewriter,
  settings
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe, req: $TSFixMe, res: $TSFixMe) => {
  req.originalBody = ['GET', 'OPTIONS', 'HEAD'].includes(req.method)
    ? null
    : await createStreamPromise(req, BYTES_LIMIT)

  const edgeFunctionsProxyURL = await edgeFunctionsProxy(req, res)

  if (edgeFunctionsProxyURL !== undefined) {
    return proxy.web(req, res, { target: edgeFunctionsProxyURL })
  }

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
    target: `http://${isIPv6(settings.frameworkHost) ? `[${settings.frameworkHost}]` : settings.frameworkHost}:${
      settings.frameworkPort
    }`,
    publicFolder: settings.dist,
    functionsServer,
    functionsPort: settings.functionsPort,
    jwtRolePath: settings.jwtRolePath,
    framework: settings.framework,
  }

  if (match) {
    // We don't want to generate an ETag for 3xx redirects.
    req[shouldGenerateETag] = ({
      statusCode
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    }: $TSFixMe) => statusCode < 300 || statusCode >= 400

    return serveRedirect({ req, res, proxy, match, options })
  }

  // The request will be served by the framework server, which means we want to
  // generate an ETag unless we're rendering an error page. The only way for
  // us to know that is by looking at the status code
  req[shouldGenerateETag] = ({
    statusCode
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  }: $TSFixMe) => statusCode >= 200 && statusCode < 300

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

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'startProxy... Remove this comment to see the full error message
const startProxy = async function ({
  addonsUrls,
  config,
  configPath,
  env,
  geoCountry,
  geolocationMode,
  getUpdatedConfig,
  inspectSettings,
  offline,
  projectDir,
  settings,
  siteInfo,
  state
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) {
  const functionsServer = settings.functionsPort ? `http://127.0.0.1:${settings.functionsPort}` : null
  const edgeFunctionsProxy = await edgeFunctions.initializeProxy({
    config,
    configPath,
    env,
    geolocationMode,
    geoCountry,
    getUpdatedConfig,
    inspectSettings,
    offline,
    projectDir,
    settings,
    siteInfo,
    state,
  })
  const proxy = await initializeProxy({
    host: settings.frameworkHost,
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
    geoCountry,
  })

  const onRequestWithOptions = onRequest.bind(undefined, {
    proxy,
    rewriter,
    settings,
    addonsUrls,
    functionsServer,
    edgeFunctionsProxy,
  })
  const server = settings.https
    ? https.createServer({ cert: settings.https.cert, key: settings.https.key }, onRequestWithOptions)
    : http.createServer(onRequestWithOptions)

  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  server.on('upgrade', function onUpgrade(req: $TSFixMe, socket: $TSFixMe, head: $TSFixMe) {
    proxy.ws(req, socket, head)
  })

  server.listen({ port: settings.port })
  await once(server, 'listening')

  const scheme = settings.https ? 'https' : 'http'
  return `${scheme}://localhost:${settings.port}`
}

const BYTES_LIMIT = 30

module.exports = { shouldGenerateETag, startProxy }
