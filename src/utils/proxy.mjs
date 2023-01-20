// @ts-check
import { Buffer } from 'buffer'
import { once } from 'events'
import { readFile } from 'fs/promises'
import http from 'http'
import https from 'https'
import { isIPv6 } from 'net'
import path from 'path'
import util from 'util'
import zlib from 'zlib'

import contentType from 'content-type'
import cookie from 'cookie'
import { get } from 'dot-prop'
import generateETag from 'etag'
import getAvailablePort from 'get-port'
import httpProxy from 'http-proxy'
import { createProxyMiddleware } from 'http-proxy-middleware'
import jwtDecode from 'jwt-decode'
import locatePath from 'locate-path'
import pFilter from 'p-filter'
import toReadableStream from 'to-readable-stream'

import {
  handleProxyRequest,
  initializeProxy as initializeEdgeFunctionsProxy,
  isEdgeFunctionsRequest,
} from '../lib/edge-functions/proxy.mjs'
import { fileExistsAsync, isFileAsync } from '../lib/fs.mjs'
import renderErrorTemplate from '../lib/render-error-template.mjs'

import { NETLIFYDEVLOG, NETLIFYDEVWARN, log, chalk } from './command-helpers.mjs'
import createStreamPromise from './create-stream-promise.mjs'
import { headersForPath, parseHeaders } from './headers.mjs'
import { createRewriter, onChanges } from './rules-proxy.mjs'
import { signRedirect } from './sign-redirect.mjs'

const decompress = util.promisify(zlib.gunzip)
const shouldGenerateETag = Symbol('Internal: response should generate ETag')

const formatEdgeFunctionError = (errorBuffer, acceptsHtml) => {
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
  return handler(req, res, () => {})
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

const serveRedirect = async function ({ env, match, options, proxy, req, res, siteInfo }) {
  if (!match) return proxy.web(req, res, options)

  options = options || req.proxyOptions || {}
  options.match = null

  if (match.proxyHeaders && Object.keys(match.proxyHeaders).length >= 0) {
    Object.entries(match.proxyHeaders).forEach(([key, value]) => {
      req.headers[key] = value
    })
  }

  if (match.signingSecret) {
    const signingSecretVar = env[match.signingSecret]

    if (signingSecretVar) {
      req.headers['x-nf-sign'] = signRedirect({
        deployContext: 'dev',
        secret: signingSecretVar.value,
        siteID: siteInfo.id,
        siteURL: siteInfo.url,
      })
    } else {
      log(
        NETLIFYDEVWARN,
        `Could not sign redirect because environment variable ${chalk.yellow(match.signingSecret)} is not set`,
      )
    }
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

const reqToURL = function (req, pathname) {
  return new URL(
    pathname,
    `${req.protocol || (req.headers.scheme && `${req.headers.scheme}:`) || 'http:'}//${
      req.headers.host || req.hostname
    }`,
  )
}

const MILLISEC_TO_SEC = 1e3

const initializeProxy = async function ({ configPath, distDir, env, host, port, projectDir, siteInfo }) {
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

  proxy.on('error', (_, req, res) => {
    res.writeHead(500, {
      'Content-Type': 'text/plain',
    })

    const message = isEdgeFunctionsRequest(req)
      ? 'There was an error with an Edge Function. Please check the terminal for more details.'
      : 'Could not proxy request.'

    res.end(message)
  })
  proxy.on('proxyReq', (proxyReq, req) => {
    if (isEdgeFunctionsRequest(req)) {
      handleProxyRequest(req, proxyReq)
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
  proxy.on('proxyRes', (proxyRes, req, res) => {
    if (proxyRes.statusCode === 404 || proxyRes.statusCode === 403) {
      if (req.alternativePaths && req.alternativePaths.length !== 0) {
        req.url = req.alternativePaths.shift()
        return proxy.web(req, res, req.proxyOptions)
      }
      if (req.proxyOptions && req.proxyOptions.match) {
        return serveRedirect({
          req,
          res,
          proxy: handlers,
          match: req.proxyOptions.match,
          options: req.proxyOptions,
          siteInfo,
          env,
        })
      }
    }

    if (req.proxyOptions.staticFile && isRedirect({ status: proxyRes.statusCode }) && proxyRes.headers.location) {
      req.url = proxyRes.headers.location
      return serveRedirect({ req, res, proxy: handlers, match: null, options: req.proxyOptions, siteInfo, env })
    }

    const responseData = []
    const requestURL = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`)
    const headersRules = headersForPath(headers, requestURL.pathname)

    // for streamed responses, we can't do etag generation nor error templates.
    // we'll just stream them through!
    const isStreamedResponse = proxyRes.headers['content-length'] === undefined
    if (isStreamedResponse) {
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

      return
    }

    proxyRes.on('data', function onData(data) {
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

      if (isEdgeFunctionsRequest(req) && isUncaughtError) {
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
    web: (req, res, options) => {
      const requestURL = new URL(req.url, 'http://127.0.0.1')
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

const onRequest = async (
  { addonsUrls, edgeFunctionsProxy, env, functionsServer, proxy, rewriter, settings, siteInfo },
  req,
  res,
) => {
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
    req[shouldGenerateETag] = ({ statusCode }) => statusCode < 300 || statusCode >= 400

    return serveRedirect({ req, res, proxy, match, options, siteInfo, env })
  }

  // The request will be served by the framework server, which means we want to
  // generate an ETag unless we're rendering an error page. The only way for
  // us to know that is by looking at the status code
  req[shouldGenerateETag] = ({ statusCode }) => statusCode >= 200 && statusCode < 300

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

export const startProxy = async function ({
  addonsUrls,
  config,
  configPath,
  debug,
  env,
  geoCountry,
  geolocationMode,
  getUpdatedConfig,
  inspectSettings,
  offline,
  projectDir,
  settings,
  siteInfo,
  state,
}) {
  const secondaryServerPort = settings.https ? await getAvailablePort() : null
  const functionsServer = settings.functionsPort ? `http://127.0.0.1:${settings.functionsPort}` : null
  const edgeFunctionsProxy = await initializeEdgeFunctionsProxy({
    config,
    configPath,
    debug,
    env,
    geolocationMode,
    geoCountry,
    getUpdatedConfig,
    inspectSettings,
    mainPort: settings.port,
    offline,
    passthroughPort: secondaryServerPort || settings.port,
    projectDir,
    siteInfo,
    state,
  })
  const proxy = await initializeProxy({
    env,
    host: settings.frameworkHost,
    port: settings.frameworkPort,
    distDir: settings.dist,
    projectDir,
    configPath,
    siteInfo,
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
    siteInfo,
    env,
  })
  const primaryServer = settings.https
    ? https.createServer({ cert: settings.https.cert, key: settings.https.key }, onRequestWithOptions)
    : http.createServer(onRequestWithOptions)
  const onUpgrade = function onUpgrade(req, socket, head) {
    proxy.ws(req, socket, head)
  }

  primaryServer.on('upgrade', onUpgrade)
  primaryServer.listen({ port: settings.port })

  const eventQueue = [once(primaryServer, 'listening')]

  // If we're running the main server on HTTPS, we need to start a secondary
  // server on HTTP for receiving passthrough requests from edge functions.
  // This lets us run the Deno server on HTTP and avoid the complications of
  // Deno talking to Node on HTTPS with potentially untrusted certificates.
  if (secondaryServerPort) {
    const secondaryServer = http.createServer(onRequestWithOptions)

    secondaryServer.on('upgrade', onUpgrade)
    secondaryServer.listen({ port: secondaryServerPort })

    eventQueue.push(once(secondaryServer, 'listening'))
  }

  await Promise.all(eventQueue)

  const scheme = settings.https ? 'https' : 'http'
  return `${scheme}://localhost:${settings.port}`
}

const BYTES_LIMIT = 30
