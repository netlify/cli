import { Buffer } from 'buffer'
import { once } from 'events'
import { readFile } from 'fs/promises'
import http, { type ServerResponse } from 'http'
import https from 'https'
import { isIPv6 } from 'net'
import { Socket } from 'node:net'
import { Readable } from 'node:stream'
import path from 'path'
import process from 'process'
import type { Duplex } from 'stream'
import url from 'url'
import util from 'util'
import zlib from 'zlib'

import { FileWatcher, fromWebResponse, mockLocation, renderFunctionErrorPage } from '@netlify/dev-utils'
import { ImageHandler } from '@netlify/images'
import { ServerHandler } from '@netlify/server-dev'

import { runBeforeProcessExit } from './shell.js'
import type { AIGatewayContext } from '@netlify/ai/bootstrap'
import contentType from 'content-type'
import { parseCookie } from 'cookie'
import { getProperty } from 'dot-prop'
import generateETag from 'etag'
import getAvailablePort from 'get-port'
import httpProxy from 'http-proxy'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { type JwtPayload, jwtDecode } from 'jwt-decode'
import { locatePath } from 'locate-path'
import { throttle } from './object-utilities.js'
import type { Match } from 'netlify-redirector'
import pFilter from 'p-filter'

import type { BaseCommand } from '../commands/index.js'
import type { NetlifyOptions } from '../commands/types.js'
import type { BlobsContextWithEdgeAccess } from '../lib/blobs/blobs.js'
import {
  handleProxyRequest,
  initializeProxy as initializeEdgeFunctionsProxy,
  isEdgeFunctionsRequest,
} from '../lib/edge-functions/proxy.js'
import { fileExistsAsync, isFileAsync } from '../lib/fs.js'
import { getFormHandler } from '../lib/functions/form-submissions-handler.js'
import { DEFAULT_FUNCTION_URL_EXPRESSION, type FunctionsRegistry } from '../lib/functions/registry.js'
import type { GeolocationMode } from '../lib/geo-location.js'
import { initializeProxy as initializeImageProxy, isImageRequest } from '../lib/images/proxy.js'

import {
  NETLIFYDEVLOG,
  NETLIFYDEVWARN,
  type NormalizedCachedConfigConfig,
  chalk,
  log,
  logError,
  warn,
} from './command-helpers.js'
import createStreamPromise from './create-stream-promise.js'
import { NFFunctionName, NFFunctionRoute, NFRequestID, headersForPath, parseHeaders } from './headers.js'
import { getErrorMessage } from './errors.js'
import { generateRequestID } from './request-id.js'
import { createRewriter, onChanges } from './rules-proxy.js'
import { signRedirect } from './sign-redirect.js'
import type { EnvironmentVariables, LocalState, Request, Rewriter, ServerSettings, SiteInfo } from './types.js'

const gunzip = util.promisify(zlib.gunzip)
const gzip = util.promisify(zlib.gzip)
const brotliDecompress = util.promisify(zlib.brotliDecompress)
const brotliCompress = util.promisify(zlib.brotliCompress)
const deflate = util.promisify(zlib.deflate)
const inflate = util.promisify(zlib.inflate)
const shouldGenerateETag = Symbol('Internal: response should generate ETag')

type ImageProxy = ReturnType<typeof initializeImageProxy>
type EdgeFunctionsProxy = Awaited<ReturnType<typeof initializeEdgeFunctionsProxy>>
type InspectSettings = Parameters<typeof initializeEdgeFunctionsProxy>[0]['inspectSettings']

interface BaseProxyOptions extends httpProxy.ServerOptions {
  target?: string | undefined
  headers?: Record<string, string>
}

// Options for requests that go through redirect matching and may fall back to a redirect or an alternative target
interface RoutingProxyOptions extends BaseProxyOptions {
  match: Match | null
  addonsUrls: Record<string, string>
  target: string
  detectTarget?: boolean | undefined
  targetHostname?: ServerSettings['frameworkHost']
  isChangingTarget?: boolean
  publicFolder: string
  functionsServer?: string | undefined
  functionsPort: number
  jwtRolePath: string
  framework?: string | undefined
  changeSettings: (newSettings: Partial<ServerSettings>) => void
  staticFile?: string | false
  status?: number | undefined
}

interface PassthroughProxyOptions extends BaseProxyOptions {
  match?: undefined
  detectTarget?: undefined
  isChangingTarget?: undefined
  staticFile?: undefined
  status?: undefined
}

type ProxyOptions = RoutingProxyOptions | PassthroughProxyOptions

interface ProxyRequest extends Request {
  proxyOptions?: ProxyOptions
  alternativePaths?: string[]
  __expectHeader?: string | undefined
  [shouldGenerateETag]?: (response: { statusCode: number }) => unknown
}

interface ProxyHandlers {
  web: (req: ProxyRequest, res: ServerResponse, options: ProxyOptions) => unknown
  ws: (req: http.IncomingMessage, socket: Duplex, head: Buffer, options: ProxyOptions) => void
}

const decompressResponseBody = async function (body: Buffer, contentEncoding = ''): Promise<Buffer> {
  switch (contentEncoding) {
    case 'gzip':
      return await gunzip(body)
    case 'br':
      return await brotliDecompress(body)
    case 'deflate':
      return await inflate(body)
    default:
      return body
  }
}

const compressResponseBody = async function (body: string, contentEncoding = ''): Promise<Buffer> {
  switch (contentEncoding) {
    case 'gzip':
      return await gzip(body)
    case 'br':
      return await brotliCompress(body)
    case 'deflate':
      return await deflate(body)
    default:
      return Buffer.from(body, 'utf8')
  }
}

type HTMLInjections = NonNullable<
  NonNullable<NonNullable<NormalizedCachedConfigConfig['dev']>['processing']>['html']
>['injections']

const injectHtml = async function (
  responseBody: Buffer,
  proxyRes: http.IncomingMessage,
  htmlInjections: HTMLInjections,
): Promise<Buffer> {
  const decompressedBody: Buffer = await decompressResponseBody(responseBody, proxyRes.headers['content-encoding'])
  const bodyWithInjections: string = (htmlInjections ?? []).reduce((accum, htmlInjection) => {
    if (!htmlInjection.html || typeof htmlInjection.html !== 'string') {
      return accum
    }
    const location = htmlInjection.location ?? 'before_closing_head_tag'
    if (location === 'before_closing_head_tag') {
      accum = accum.replace('</head>', `${htmlInjection.html}</head>`)
    } else if (location === 'before_closing_body_tag') {
      accum = accum.replace('</body>', `${htmlInjection.html}</body>`)
    }
    return accum
  }, decompressedBody.toString())
  return await compressResponseBody(bodyWithInjections, proxyRes.headers['content-encoding'])
}

const formatEdgeFunctionError = (errorBuffer: Buffer, acceptsHtml: boolean): string => {
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

function isInternal(url?: string): boolean {
  return url?.startsWith('/.netlify/') ?? false
}

function isFunction(functionsPort: boolean | number | undefined, url: string | undefined) {
  // @ts-expect-error FIXME: throws when `url` is undefined
  return functionsPort && url.match(DEFAULT_FUNCTION_URL_EXPRESSION)
}

function getAddonUrl(addonsUrls: Record<string, string>, req: http.IncomingMessage) {
  const matches = req.url?.match(/^\/.netlify\/([^/]+)(\/.*)/)
  const addonUrl = matches && addonsUrls[matches[1]]
  return addonUrl ? `${addonUrl}${matches[2]}` : null
}

const getStatic = async function (pathname: string, publicFolder: string) {
  const alternatives = [pathname, ...alternativePathsFor(pathname)].map((filePath) =>
    path.resolve(publicFolder, filePath.slice(1)),
  )

  const file = await locatePath(alternatives)
  if (file === undefined) {
    return false
  }

  return `/${path.relative(publicFolder, file)}`
}

const isEndpointExists = async function (endpoint: string, origin: string) {
  const url = new URL(endpoint, origin)
  try {
    const res = await fetch(url, { method: 'HEAD' })
    return res.status !== 404
  } catch {
    return false
  }
}

const isExternal = function (match: Match): boolean {
  return 'to' in match && /^https?:\/\//.exec(match.to) != null
}

const stripOrigin = function ({ hash, pathname, search }: URL): string {
  return `${pathname}${search}${hash}`
}

const proxyToExternalUrl = function ({
  dest,
  destURL,
  req,
  res,
}: {
  dest: URL
  destURL: string
  req: Request
  res: ServerResponse
}) {
  const handler = createProxyMiddleware({
    target: dest.origin,
    changeOrigin: true,
    pathRewrite: () => destURL,
    ...(Buffer.isBuffer(req.originalBody) && { buffer: Readable.from(req.originalBody) }),
  })
  void handler(req, res, () => {})
}

const handleAddonUrl = function ({ addonUrl, req, res }: { addonUrl: string; req: Request; res: ServerResponse }) {
  const dest = new URL(addonUrl)
  const destURL = stripOrigin(dest)

  proxyToExternalUrl({ req, res, dest, destURL })
}

const isRedirect = function (match: Match | { status?: number | undefined }): boolean {
  return 'status' in match && match.status != null && match.status >= 300 && match.status <= 400
}

const render404 = async function (publicFolder: string): Promise<string> {
  const maybe404Page = path.resolve(publicFolder, '404.html')
  try {
    const isFile = await isFileAsync(maybe404Page)
    if (isFile) return await readFile(maybe404Page, 'utf-8')
  } catch (error) {
    console.warn(
      NETLIFYDEVWARN,
      'Error while serving 404.html file',
      error instanceof Error ? error.message : error?.toString(),
    )
  }

  return 'Not Found'
}

// Used as an optimization to avoid dual lookups for missing assets
const assetExtensionRegExp = /\.(html?|png|jpg|js|css|svg|gif|ico|woff|woff2)$/

const alternativePathsFor = function (url: string): string[] {
  if (isFunction(true, url)) {
    return []
  }

  const paths = []
  // eslint-disable-next-line @typescript-eslint/prefer-string-starts-ends-with -- FIXME: `endsWith` differs for non-string values
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

const notifyActivity = throttle((api: NetlifyOptions['api'], siteId: string, devServerId: string) => {
  // @ts-expect-error FIXME(@netlify/api): internal `markDevServerActivity` method is missing from the generated types
  api.markDevServerActivity({ siteId, devServerId }).catch((error: unknown) => {
    console.error(`${NETLIFYDEVWARN} Failed to notify activity`, error)
  })
}, 30 * 1000)

const serveRedirect = async function ({
  env,
  functionsRegistry,
  imageProxy,
  match,
  options,
  proxy,
  req,
  res,
  siteInfo,
}: {
  env: EnvironmentVariables
  functionsRegistry?: FunctionsRegistry | null | undefined
  imageProxy: ImageProxy
  match: Match | null
  options: RoutingProxyOptions
  proxy: ProxyHandlers
  req: ProxyRequest
  res: ServerResponse
  siteInfo: SiteInfo
}) {
  if (!match) return proxy.web(req, res, options)

  // FIXME: `options` is always set by callers, so neither fallback applies
  options = options || req.proxyOptions || {}
  options.match = null

  if (match.force404) {
    res.writeHead(404)
    res.end(await render404(options.publicFolder))
    return
  }

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
    handleAddonUrl({ req, res, addonUrl: urlForAddons })
    return
  }

  const originalURL = req.url
  if (match.exceptions && match.exceptions.JWT) {
    // Some values of JWT can start with :, so, make sure to normalize them
    const expectedRoles = new Set(
      match.exceptions.JWT.split(',').map((value) => (value.startsWith(':') ? value.slice(1) : value)),
    )

    const cookieValues = parseCookie(req.headers.cookie || '')
    const token = cookieValues.nf_jwt

    // Serve not found by default
    req.url = '/.netlify/non-existent-path'

    if (token) {
      let jwtValue: JwtPayload = {}
      try {
        jwtValue = jwtDecode<JwtPayload | null>(token) || {}
      } catch (error) {
        console.warn(NETLIFYDEVWARN, 'Error while decoding JWT provided in request', getErrorMessage(error))
        res.writeHead(400)
        res.end('Invalid JWT provided. Please see logs for more info.')
        return
      }

      if ((jwtValue.exp || 0) < Math.round(Date.now() / MILLISEC_TO_SEC)) {
        console.warn(NETLIFYDEVWARN, 'Expired JWT provided in request', req.url)
      } else {
        const presentedRoles = getProperty(jwtValue, options.jwtRolePath) || []
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
  const isHiddenProxy =
    match.proxyHeaders &&
    Object.entries(match.proxyHeaders).some(([key, val]) => key.toLowerCase() === 'x-nf-hidden-proxy' && val === 'true')

  const staticFile = await getStatic(decodeURIComponent(reqUrl.pathname), options.publicFolder)
  const endpointExists =
    !staticFile &&
    !isHiddenProxy &&
    process.env.NETLIFY_DEV_SERVER_CHECK_SSG_ENDPOINTS &&
    (await isEndpointExists(decodeURIComponent(reqUrl.pathname), options.target))
  if (staticFile || endpointExists) {
    const pathname = staticFile || reqUrl.pathname
    req.url = encodeURI(decodeURI(pathname)) + reqUrl.search
    // if there is an existing static file and it is not a forced redirect, return the file
    if (!match.force) {
      return proxy.web(req, res, { ...options, staticFile })
    }
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
        if (!isHiddenProxy) {
          console.log(`${NETLIFYDEVLOG} Proxying to ${dest}`)
        }
        proxyToExternalUrl({ req, res, dest, destURL })
        return
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
    const matchingFunction =
      functionsRegistry &&
      // @ts-expect-error FIXME: `req.method` may be undefined and the static file callback returns a boolean, not a promise
      (await functionsRegistry.getFunctionForURLPath(destURL, req.method, () => Boolean(destStaticFile)))
    let statusValue
    if (
      match.force ||
      (!staticFile && ((!options.framework && destStaticFile) || isInternal(destURL) || matchingFunction))
    ) {
      req.url = destStaticFile ? destStaticFile + dest.search : destURL
      const { status } = match
      statusValue = status
      console.log(`${NETLIFYDEVLOG} Rewrote URL to`, req.url)
    }

    if (matchingFunction) {
      const functionHeaders = matchingFunction.func
        ? {
            [NFFunctionName]: matchingFunction.func?.name,
            [NFFunctionRoute]: matchingFunction.route,
          }
        : {}
      const url = reqToURL(req, originalURL)
      req.headers['x-netlify-original-pathname'] = url.pathname
      req.headers['x-netlify-original-search'] = url.search

      // @ts-expect-error FIXME: sends the whole route object instead of its pattern in the function route header
      return proxy.web(req, res, { headers: functionHeaders, target: options.functionsServer })
    }
    if (isImageRequest(req)) {
      return imageProxy(req, res)
    }
    const addonUrl = getAddonUrl(options.addonsUrls, req)
    if (addonUrl) {
      handleAddonUrl({ req, res, addonUrl })
      return
    }

    return proxy.web(req, res, { ...options, status: statusValue })
  }

  return proxy.web(req, res, options)
}

const reqToURL = function (req: Request, pathname: string | undefined) {
  return new URL(
    // @ts-expect-error FIXME: an undefined `pathname` resolves to `/undefined`
    pathname,
    `${req.protocol || (req.headers.scheme && `${req.headers.scheme}:`) || 'http:'}//${
      req.headers.host || req.hostname
    }`,
  )
}

const MILLISEC_TO_SEC = 1e3

const initializeProxy = async function ({
  config,
  configPath,
  distDir,
  env,
  host,
  imageProxy,
  port,
  projectDir,
  siteInfo,
}: {
  config: NormalizedCachedConfigConfig
  configPath?: string | undefined
  distDir: string
  env: EnvironmentVariables
  host?: string | undefined
  imageProxy: ImageProxy
  port?: number | undefined
  projectDir: string
  siteInfo: SiteInfo
}): Promise<ProxyHandlers> {
  const proxy = httpProxy.createProxyServer<ProxyRequest>({
    selfHandleResponse: true,
    // @ts-expect-error FIXME: `host` and `port` may be undefined
    target: { host, port },
  })
  const headersFiles = [...new Set([path.resolve(projectDir, '_headers'), path.resolve(distDir, '_headers')])]

  let headers = await parseHeaders({ headersFiles, configPath, config })

  const watchedHeadersFiles = configPath === undefined ? headersFiles : [...headersFiles, configPath]
  onChanges(watchedHeadersFiles, async () => {
    const existingHeadersFiles = await pFilter(watchedHeadersFiles, fileExistsAsync)
    console.log(
      `${NETLIFYDEVLOG} Reloading headers files from`,
      existingHeadersFiles.map((headerFile) => path.relative(projectDir, headerFile)),
    )
    headers = await parseHeaders({ headersFiles, configPath, config })
  })

  // @ts-expect-error TS(2339) FIXME: Property 'before' does not exist on type 'Server'.
  proxy.before('web', 'stream', (req: ProxyRequest) => {
    // See https://github.com/http-party/node-http-proxy/issues/1219#issuecomment-511110375
    if (req.headers.expect) {
      req.__expectHeader = req.headers.expect
      delete req.headers.expect
    }
  })

  proxy.on('error', (err, req, res, proxyUrl) => {
    const options = req.proxyOptions

    const isConRefused = 'code' in err && err.code === 'ECONNREFUSED'
    if (options?.detectTarget && !(res instanceof Socket) && isConRefused && proxyUrl) {
      // got econnrefused while detectTarget set to true -> try to switch between current ipVer and other (4 to 6 and vice versa)

      // proxyUrl is parsed in http-proxy using url, parsing the same here. Difference between it and
      // URL that hostname not includes [] symbols when using url.parse
      // eslint-disable-next-line n/no-deprecated-api
      const targetUrl = typeof proxyUrl === 'string' ? url.parse(proxyUrl) : proxyUrl
      const isCurrentHost = targetUrl.hostname === options.targetHostname
      if (targetUrl.hostname && isCurrentHost) {
        const newHost = isIPv6(targetUrl.hostname) ? '127.0.0.1' : '::1'
        options.target = `http://${isIPv6(newHost) ? `[${newHost}]` : newHost}:${targetUrl.port}`
        options.targetHostname = newHost
        options.isChangingTarget = true
        // http-proxy attaches new 'aborted'/'error' listeners on req for every proxy.web call; without
        // clearing them first, retries leak listeners and the closures retain per-attempt proxyReq objects.
        req.removeAllListeners('aborted')
        req.removeAllListeners('error')
        proxy.web(req, res, options)
        return
      }
    }

    if (res instanceof http.ServerResponse) {
      res.writeHead(500, {
        'Content-Type': 'text/plain',
      })
    }

    const message = isEdgeFunctionsRequest(req)
      ? 'There was an error with an Edge Function. Please check the terminal for more details.'
      : 'Could not proxy request.'

    res.end(message)
  })

  proxy.on('proxyReq', (proxyReq, req) => {
    const requestID = generateRequestID()

    proxyReq.setHeader(NFRequestID, requestID)
    req.headers[NFRequestID] = requestID

    if (isEdgeFunctionsRequest(req)) {
      handleProxyRequest(req, proxyReq)
    }

    if (req.__expectHeader) {
      proxyReq.setHeader('Expect', req.__expectHeader)
    }
    if (req.originalBody) {
      proxyReq.write(req.originalBody)
    }
  })

  proxy.on('proxyRes', (proxyRes, req, res) => {
    res.setHeader('server', 'Netlify')

    const requestID = req.headers[NFRequestID]

    if (requestID) {
      res.setHeader(NFRequestID, requestID)
    }

    // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style -- FIXME: always set by `handlers.web`
    const options = req.proxyOptions as ProxyOptions

    if (options.isChangingTarget) {
      // got a response after switching the ipVer for host (and its not an error since we will be in on('error') handler) - let's remember this host now

      // options are not exported in ts for the proxy:
      // @ts-expect-error TS(2339) FIXME: Property 'options' does not exist on type 'In...
      proxy.options.target.host = options.targetHostname

      options.changeSettings?.({
        frameworkHost: options.targetHostname,
        detectFrameworkHost: false,
      })
      console.log(`${NETLIFYDEVLOG} Switched host to ${options.targetHostname}`)
    }

    if (proxyRes.statusCode === 404 || proxyRes.statusCode === 403) {
      // If a request for `/path` has failed, we'll a few variations like
      // `/path/index.html` to mimic the CDN behavior.
      if (req.alternativePaths && req.alternativePaths.length !== 0) {
        req.url = req.alternativePaths.shift()
        // http-proxy attaches new 'aborted'/'error' listeners on req for every proxy.web call; without
        // clearing them first, retries leak listeners and the closures retain per-attempt proxyReq objects.
        req.removeAllListeners('aborted')
        req.removeAllListeners('error')
        proxy.web(req, res, req.proxyOptions)
        return
      }

      // The request has failed but we might still have a matching redirect
      // rule (without `force`) that should kick in. This is how we mimic the
      // file shadowing behavior from the CDN.
      if (options && options.match) {
        return serveRedirect({
          // We don't want to match functions at this point because any redirects
          // to functions will have already been processed, so we don't supply a
          // functions registry to `serveRedirect`.
          functionsRegistry: null,
          req,
          res,
          proxy: handlers,
          imageProxy,
          match: options.match,
          options,
          siteInfo,
          env,
        })
      }
    }

    if (options.staticFile && isRedirect({ status: proxyRes.statusCode }) && proxyRes.headers.location) {
      req.url = proxyRes.headers.location
      return serveRedirect({
        // We don't want to match functions at this point because any redirects
        // to functions will have already been processed, so we don't supply a
        // functions registry to `serveRedirect`.
        functionsRegistry: null,
        req,
        res,
        proxy: handlers,
        imageProxy,
        match: null,
        options,
        siteInfo,
        env,
      })
    }

    const responseData: Buffer[] = []
    // @ts-expect-error FIXME: an undefined `req.url` resolves to `/undefined`
    const requestURL = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`)
    const headersRules = headersForPath(headers, requestURL.pathname)

    const configInjections = config.dev?.processing?.html?.injections ?? []
    const htmlInjections =
      configInjections.length > 0 && proxyRes.headers?.['content-type']?.startsWith('text/html')
        ? configInjections
        : undefined

    // for streamed responses, we can't do etag generation nor error templates.
    // we'll just stream them through!
    // when html_injections are present in dev config, we can't use streamed response
    const isStreamedResponse = proxyRes.headers['content-length'] === undefined
    if (isStreamedResponse && !htmlInjections) {
      Object.entries(headersRules).forEach(([key, val]) => {
        res.setHeader(key, val)
      })
      // @ts-expect-error FIXME: `proxyRes.statusCode` is always set on responses, but typed as optional
      res.writeHead(options.status || proxyRes.statusCode, proxyRes.headers)

      proxyRes.on('data', function onData(data: Buffer) {
        res.write(data)
      })

      proxyRes.on('end', function onEnd() {
        res.end()
      })

      return
    }

    proxyRes.on('data', function onData(data: Buffer) {
      responseData.push(data)
    })

    proxyRes.on('end', async function onEnd() {
      let responseBody: Buffer = Buffer.concat(responseData)

      let responseStatus = options.status || proxyRes.statusCode

      // `req[shouldGenerateETag]` may contain a function that determines
      // whether the response should have an ETag header.
      if (
        typeof req[shouldGenerateETag] === 'function' &&
        // @ts-expect-error FIXME: `proxyRes.statusCode` is always set on responses, but typed as optional
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
        const acceptsHtml = req.headers.accept?.includes('text/html') ?? false
        const decompressedBody = await decompressResponseBody(responseBody, proxyRes.headers['content-encoding'])
        const formattedBody = formatEdgeFunctionError(decompressedBody, acceptsHtml)
        const errorResponse = acceptsHtml
          ? await renderFunctionErrorPage(formattedBody, 'edge function')
          : formattedBody
        const contentLength = Buffer.from(errorResponse, 'utf8').byteLength

        res.setHeader('content-length', contentLength)
        res.statusCode = 500
        res.write(errorResponse)
        return res.end()
      }

      let proxyResHeaders = proxyRes.headers

      if (htmlInjections) {
        responseBody = await injectHtml(responseBody, proxyRes, htmlInjections)
        proxyResHeaders = {
          ...proxyResHeaders,
          'content-length': String(responseBody.byteLength),
        }
        delete proxyResHeaders['transfer-encoding']
      }

      // @ts-expect-error FIXME: `proxyRes.statusCode` is always set on responses, but typed as optional
      res.writeHead(responseStatus, proxyResHeaders)

      if (responseStatus !== 304) {
        res.write(responseBody)
      }

      res.end()
      return undefined
    })
    return undefined
  })

  const handlers: ProxyHandlers = {
    web: (req, res, options) => {
      // @ts-expect-error FIXME: an undefined `req.url` resolves to `/undefined`
      const requestURL = new URL(req.url, 'http://127.0.0.1')
      req.proxyOptions = options
      req.alternativePaths = alternativePathsFor(requestURL.pathname).map((filePath) => filePath + requestURL.search)
      // Ref: https://nodejs.org/api/net.html#net_socket_remoteaddress
      req.headers['x-forwarded-for'] = req.connection.remoteAddress || ''
      proxy.web(req, res, options)
      return undefined
    },
    ws: (req, socket, head, options) => {
      proxy.ws(req, socket, head, options)
    },
  }

  return handlers
}

const onRequest = async (
  {
    addonsUrls,
    api,
    edgeFunctionsProxy,
    env,
    functionsRegistry,
    functionsServer,
    imageProxy,
    proxy,
    rewriter,
    serverHandler,
    settings,
    siteInfo,
  }: {
    addonsUrls: Record<string, string>
    api?: NetlifyOptions['api'] | undefined
    edgeFunctionsProxy?: EdgeFunctionsProxy | undefined
    env: EnvironmentVariables
    functionsRegistry?: FunctionsRegistry | undefined
    functionsServer?: string | undefined
    imageProxy: ImageProxy
    proxy: ProxyHandlers
    rewriter: Rewriter
    serverHandler?: ServerHandler | undefined
    settings: ServerSettings
    siteInfo: SiteInfo
  },
  req: ProxyRequest,
  res: ServerResponse,
) => {
  req.originalBody =
    req.method && ['GET', 'OPTIONS', 'HEAD'].includes(req.method) ? null : await createStreamPromise(req, BYTES_LIMIT)

  if (isImageRequest(req)) {
    return imageProxy(req, res)
  }

  const edgeFunctionsProxyURL = await edgeFunctionsProxy?.(req)

  if (edgeFunctionsProxyURL !== undefined) {
    return proxy.web(req, res, { target: edgeFunctionsProxyURL })
  }

  const functionMatch =
    functionsRegistry &&
    // @ts-expect-error FIXME: `req.url` and `req.method` may be undefined and the static file callback resolves to a path, not a boolean
    (await functionsRegistry.getFunctionForURLPath(req.url, req.method, () =>
      getStatic(decodeURIComponent(reqToURL(req, req.url).pathname), settings.dist ?? ''),
    ))
  if (functionMatch) {
    // Setting an internal header with the function name so that we don't
    // have to match the URL again in the functions server.
    const headers: Record<string, string> = {}

    if (functionMatch.func) {
      headers[NFFunctionName] = functionMatch.func.name
    }

    if (functionMatch.route) {
      headers[NFFunctionRoute] = functionMatch.route.pattern
    }

    return proxy.web(req, res, { headers, target: functionsServer })
  }

  const addonUrl = getAddonUrl(addonsUrls, req)
  if (addonUrl) {
    handleAddonUrl({ req, res, addonUrl })
    return
  }

  if (serverHandler) {
    try {
      const requestURL = reqToURL(req, req.url)
      const serverMatch = await serverHandler.match(new Request(requestURL))

      if (serverMatch) {
        const staticFile = await getStatic(decodeURIComponent(requestURL.pathname), settings.dist ?? '')

        if (!staticFile) {
          const headers = new Headers()

          for (let index = 0; index < req.rawHeaders.length; index += 2) {
            headers.append(req.rawHeaders[index], req.rawHeaders[index + 1])
          }

          const response = await serverMatch.handle(
            new Request(requestURL, {
              body: req.originalBody,
              headers,
              method: req.method,
            }),
          )

          await fromWebResponse(response, res)

          return
        }
      }
    } catch (error) {
      // The response may have failed mid-stream, in which case the head is
      // out and the only remaining option is dropping the connection.
      if (res.headersSent) {
        res.destroy()
      } else {
        res.writeHead(500)
        res.end(error instanceof Error ? error.message : 'Failed to serve request from Netlify Server')
      }

      return
    }
  }

  const match = await rewriter(req)
  const options: RoutingProxyOptions = {
    match,
    addonsUrls,
    target: `http://${
      settings.frameworkHost && isIPv6(settings.frameworkHost) ? `[${settings.frameworkHost}]` : settings.frameworkHost
    }:${settings.frameworkPort}`,
    detectTarget: settings.detectFrameworkHost,
    targetHostname: settings.frameworkHost,
    publicFolder: settings.dist,
    functionsServer,
    functionsPort: settings.functionsPort,
    jwtRolePath: settings.jwtRolePath,
    framework: settings.framework,
    changeSettings(newSettings: Partial<ServerSettings>) {
      Object.assign(settings, newSettings)
    },
  }

  const maybeNotifyActivity = () => {
    const skipInternalUrls = ['/.ntlfy-dev/up', '/.ntlfy-dev/health']
    const isInternalRequest = req.url?.startsWith('/.ntlfy-dev/')
    const trackRequest = isInternalRequest ? !skipInternalUrls.includes(req.url ?? '') : req.method === 'GET'
    if (api && process.env.NETLIFY_DEV_SERVER_ID && trackRequest) {
      notifyActivity(api, siteInfo.id, process.env.NETLIFY_DEV_SERVER_ID)
    }
  }

  if (match) {
    maybeNotifyActivity()

    // We don't want to generate an ETag for 3xx redirects.
    req[shouldGenerateETag] = ({ statusCode }) => statusCode < 300 || statusCode >= 400

    return serveRedirect({ req, res, proxy, imageProxy, match, options, siteInfo, env, functionsRegistry })
  }

  // The request will be served by the framework server, which means we want to
  // generate an ETag unless we're rendering an error page. The only way for
  // us to know that is by looking at the status code
  req[shouldGenerateETag] = ({ statusCode }) => statusCode >= 200 && statusCode < 300

  const hasFormSubmissionHandler = functionsRegistry && getFormHandler({ functionsRegistry, logWarning: false })

  const ct = req.headers['content-type'] ? contentType.parse(req).type : ''
  if (
    hasFormSubmissionHandler &&
    functionsServer &&
    req.method === 'POST' &&
    !isInternal(req.url) &&
    (ct.endsWith('/x-www-form-urlencoded') || ct === 'multipart/form-data')
  ) {
    return proxy.web(req, res, { target: functionsServer })
  }

  maybeNotifyActivity()

  proxy.web(req, res, options)
  return undefined
}

export const getProxyUrl = function (settings: Pick<ServerSettings, 'https' | 'port'>) {
  const scheme = settings.https ? 'https' : 'http'
  return `${scheme}://localhost:${settings.port}`
}

export const startProxy = async function ({
  accountId,
  addonsUrls,
  aiGatewayContext,
  api,
  blobsContext,
  command,
  config,
  configPath,
  debug,
  disableEdgeFunctions,
  env,
  functionsRegistry,
  geoCountry,
  geolocationMode,
  getUpdatedConfig,
  inspectSettings,
  offline,
  projectDir,
  repositoryRoot,
  settings,
  siteInfo,
  state,
  watchIgnore,
  deployEnvironment,
}: {
  accountId: string | undefined
  addonsUrls: Record<string, string>
  aiGatewayContext?: AIGatewayContext | null
  api?: NetlifyOptions['api'] | undefined
  blobsContext?: BlobsContextWithEdgeAccess | undefined
  command: BaseCommand
  config: NormalizedCachedConfigConfig
  configPath?: string | undefined
  debug: boolean | undefined
  disableEdgeFunctions: boolean | undefined
  env: EnvironmentVariables
  functionsRegistry?: FunctionsRegistry | undefined
  geoCountry?: string | undefined
  geolocationMode: GeolocationMode
  getUpdatedConfig: () => Promise<NormalizedCachedConfigConfig>
  inspectSettings: InspectSettings
  offline: boolean | undefined
  projectDir: string
  repositoryRoot?: string | undefined
  settings: ServerSettings
  siteInfo: SiteInfo
  state: LocalState
  watchIgnore: string[]
  deployEnvironment: { key: string; value: string; isSecret: boolean; scopes: string[] }[]
}) {
  const secondaryServerPort = settings.https ? await getAvailablePort() : null
  // FIXME: typed as optional, but is `null` rather than `undefined` when there is no functions port
  const functionsServer = (settings.functionsPort ? `http://127.0.0.1:${settings.functionsPort}` : null) as
    | string
    | undefined

  let edgeFunctionsProxy: EdgeFunctionsProxy | undefined
  if (disableEdgeFunctions) {
    log(
      NETLIFYDEVWARN,
      'Edge functions are disabled. Run without the --internal-disable-edge-functions flag to enable them.',
    )
  } else {
    edgeFunctionsProxy = await initializeEdgeFunctionsProxy({
      accountId,
      aiGatewayContext,
      blobsContext,
      command,
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
      settings,
      projectDir,
      repositoryRoot,
      siteInfo,
      state,
      watchIgnore,
      deployEnvironment,
    })
  }

  const imageHandler = new ImageHandler({
    logger: { log, warn, error: logError },
    imagesConfig: config.images,
  })

  const serverEntryEnabled =
    process.env.EXPERIMENTAL_NETLIFY_SERVER === 'true' || Boolean(siteInfo?.feature_flags?.netlify_build_server_entry)

  let serverHandler: ServerHandler | undefined

  if (serverEntryEnabled) {
    const serverFileWatcher = new FileWatcher()

    serverHandler = new ServerHandler({
      accountID: siteInfo?.account_id,
      fileWatcher: serverFileWatcher,
      geolocation: mockLocation,
      logger: { log, warn, error: logError },
      projectRoot: projectDir,
      siteID: siteInfo?.id,
    })

    const handlerToStop = serverHandler

    runBeforeProcessExit(async () => {
      await handlerToStop.stop()
      await serverFileWatcher.close()
    })
  }
  const imageProxy = initializeImageProxy({
    settings,
    imageHandler,
  })

  const proxy = await initializeProxy({
    env,
    host: settings.frameworkHost,
    port: settings.frameworkPort,
    distDir: settings.dist,
    projectDir,
    configPath,
    siteInfo,
    imageProxy,
    config,
  })

  const rewriter = await createRewriter({
    config,
    configPath,
    distDir: settings.dist,
    geoCountry,
    jwtSecret: settings.jwtSecret,
    jwtRoleClaim: settings.jwtRolePath,
    projectDir,
  })

  const onRequestWithOptions = onRequest.bind(undefined, {
    proxy,
    rewriter,
    serverHandler,
    settings,
    addonsUrls,
    functionsRegistry,
    functionsServer,
    edgeFunctionsProxy,
    imageProxy,
    siteInfo,
    env,
    api,
  })
  const primaryServer = settings.https
    ? https.createServer({ cert: settings.https.cert, key: settings.https.key }, onRequestWithOptions)
    : http.createServer(onRequestWithOptions)
  const onUpgrade = async function onUpgrade(req: http.IncomingMessage, socket: Duplex, head: Buffer) {
    if (serverHandler) {
      let handled = false

      try {
        handled = await serverHandler.handleUpgrade(req, socket, head)
      } catch (error) {
        logError(
          `Failed to hand over upgrade request to server: ${error instanceof Error ? error.message : String(error)}`,
        )
        socket.destroy()

        return
      }

      if (handled) {
        return
      }
    }

    const match = await rewriter(req)
    if (match && !match.force404 && isExternal(match)) {
      const reqUrl = reqToURL(req, req.url)
      const dest = new URL(match.to, `${reqUrl.protocol}//${reqUrl.host}`)
      const destURL = stripOrigin(dest)
      // @ts-expect-error FIXME: `pathRewrite` is an http-proxy-middleware option that http-proxy ignores, so the path isn't rewritten
      proxy.ws(req, socket, head, { target: dest.origin, changeOrigin: true, pathRewrite: () => destURL })
      return
    }
    proxy.ws(req, socket, head, {})
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

  return getProxyUrl(settings)
}

const BYTES_LIMIT = 30
