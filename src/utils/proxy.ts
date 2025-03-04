import { Buffer } from 'buffer'
import { once } from 'events'
import { readFile } from 'fs/promises'
import http, { type ServerResponse } from 'http'
import https from 'https'
import { isIPv6 } from 'net'
import { Readable } from 'node:stream'
import path from 'path'
import process from 'process'
import type { Duplex } from 'stream'
import util from 'util'
import zlib from 'zlib'

import contentType from 'content-type'
import cookie from 'cookie'
import { getProperty } from 'dot-prop'
import generateETag from 'etag'
import getAvailablePort from 'get-port'
import httpProxy, { type ServerOptions } from 'http-proxy'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { jwtDecode, type JwtPayload } from 'jwt-decode'
import { locatePath } from 'locate-path'
import type { Match } from 'netlify-redirector'
import pFilter from 'p-filter'
import throttle from 'lodash/throttle.js'

import type { BaseCommand } from '../commands/index.js'
import type { $TSFixMe, NetlifyOptions } from '../commands/types.js'
import {
  handleProxyRequest,
  initializeProxy as initializeEdgeFunctionsProxy,
  isEdgeFunctionsRequest,
} from '../lib/edge-functions/proxy.js'
import { fileExistsAsync, isFileAsync } from '../lib/fs.js'
import { getFormHandler } from '../lib/functions/form-submissions-handler.js'
import { DEFAULT_FUNCTION_URL_EXPRESSION } from '../lib/functions/registry.js'
import { initializeProxy as initializeImageProxy, isImageRequest } from '../lib/images/proxy.js'
import renderErrorTemplate from '../lib/render-error-template.js'

import { NETLIFYDEVLOG, NETLIFYDEVWARN, chalk, log } from './command-helpers.js'
import createStreamPromise from './create-stream-promise.js'
import { NFFunctionName, NFFunctionRoute, NFRequestID, headersForPath, parseHeaders } from './headers.js'
import { generateRequestID } from './request-id.js'
import { createRewriter, onChanges } from './rules-proxy.js'
import { signRedirect } from './sign-redirect.js'
import type { Rewriter, ExtraServerOptions, ServerSettings } from './types.js'
import { ClientRequest, IncomingMessage } from 'node:http'

declare module 'http' {
  // This is only necessary because we're attaching custom junk to the `req` given to us
  // by the `http-proxy` module. Since it in turn imports its request object type from `http`,
  // we have no choice but to augment the `http` module itself globally.
  // NOTE: to be extra clear, this is *augmenting* the existing type:
  // https://www.typescriptlang.org/docs/handbook/declaration-merging.html#merging-interfaces.
  interface IncomingMessage {
    originalBody?: Buffer | null
    protocol?: string
    hostname?: string
    __expectHeader?: string
    alternativePaths?: string[]
    proxyOptions: ServerOptions
  }
}

const gunzip = util.promisify(zlib.gunzip)
const gzip = util.promisify(zlib.gzip)
const brotliDecompress = util.promisify(zlib.brotliDecompress)
const brotliCompress = util.promisify(zlib.brotliCompress)
const deflate = util.promisify(zlib.deflate)
const inflate = util.promisify(zlib.inflate)

const shouldGenerateETagSymbol = Symbol('Internal: response should generate ETag')
type ShouldGenerateETag = ({ statusCode }: { statusCode: number }) => boolean
const getShouldGenerateETag = (
  req: IncomingMessage,
  // @ts-expect-error(serhalp -- See `types/http/index.d.ts`. It isn't possible to reference
  // a unique symbol from within our `http` type declaration augmentation. This function at
  // least lets us limit the poor typing blast radius.
): undefined | ShouldGenerateETag => req[shouldGenerateETagSymbol]
const setShouldGenerateETag = (req: IncomingMessage, shouldGenerateETag: ShouldGenerateETag): void => {
  // @ts-expect-error(serhalp -- See above
  req[shouldGenerateETagSymbol] = shouldGenerateETag
}

type ExtendedServerOptions = ServerOptions | ExtraServerOptions

const getExtraServerOption = (
  options: ExtendedServerOptions,
  name: keyof ExtendedServerOptions,
): ExtendedServerOptions[typeof name] => {
  if (name in options) {
    return options[name]
  }
  return
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

type HTMLInjections = NonNullable<NonNullable<NetlifyOptions['config']['dev']['processing']>['html']>['injections']

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

const formatEdgeFunctionError = (errorBuffer: Buffer<ArrayBufferLike>, acceptsHtml: boolean): string => {
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

function isFunction(functionsPort: boolean | number | undefined, url: string) {
  return functionsPort && url.match(DEFAULT_FUNCTION_URL_EXPRESSION)
}

function getAddonUrl(addonsUrls: Record<string, string>, req: IncomingMessage) {
  const matches = req.url?.match(/^\/.netlify\/([^/]+)(\/.*)/)
  const addonUrl = matches && addonsUrls[matches[1]]
  return addonUrl ? `${addonUrl}${matches[2]}` : null
}

const getStatic = async function (pathname: string, publicFolder: string): Promise<string | false> {
  const alternatives = [pathname, ...alternativePathsFor(pathname)].map((filePath) =>
    path.resolve(publicFolder, filePath.slice(1)),
  )

  const file = await locatePath(alternatives)
  if (file === undefined) {
    return false
  }

  return `/${path.relative(publicFolder, file)}`
}

const isEndpointExists = async function (endpoint: string, origin?: string | undefined) {
  const url = new URL(endpoint, origin)
  try {
    const res = await fetch(url, { method: 'HEAD' })
    return res.status !== 404
  } catch (e) {
    return false
  }
}

const isExternal = function (match: Match) {
  return 'to' in match && match.to.match(/^https?:\/\//)
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
  req: IncomingMessage
  res: ServerResponse
}) {
  const handler = createProxyMiddleware({
    target: dest.origin,
    changeOrigin: true,
    pathRewrite: () => destURL,
    // hide logging
    logLevel: 'warn',
    ...(Buffer.isBuffer(req.originalBody) && { buffer: Readable.from(req.originalBody) }),
  })
  // @ts-expect-error TS(2345) FIXME: Argument of type 'IncomingMessage' is not assignable to parameter of type 'Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>'.
  return handler(req, res, () => {})
}

const handleAddonUrl = function ({
  addonUrl,
  req,
  res,
}: {
  req: IncomingMessage
  res: ServerResponse
  addonUrl: string
}) {
  const dest = new URL(addonUrl)
  const destURL = stripOrigin(dest)

  return proxyToExternalUrl({ req, res, dest, destURL })
}

const isRedirect = function (match: Match) {
  return 'status' in match && match.status >= 300 && match.status <= 400
}

const render404 = async function (publicFolder?: string) {
  const maybe404Page = path.resolve(publicFolder ?? '', '404.html')
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

const alternativePathsFor = function (url: string) {
  if (isFunction(true, url)) {
    return []
  }

  const paths: string[] = []
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
  // eslint-disable-next-line promise/prefer-await-to-callbacks, promise/prefer-await-to-then
  api.markDevServerActivity({ siteId, devServerId }).catch((error) => {
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
  options: ExtendedServerOptions
  req: IncomingMessage
  res: ServerResponse
  match: Match | null
} & Record<string, $TSFixMe>) {
  if (!match) return proxy.web(req, res, options)

  options = {
    ...(options ?? req.proxyOptions),
    match: null,
  }

  if (match.force404) {
    res.writeHead(404)
    res.end(await render404(getExtraServerOption(options, 'publicFolder')))
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

  if (isFunction(getExtraServerOption(options, 'functionsPort'), req.url ?? '')) {
    return proxy.web(req, res, { target: options.functionsServer })
  }

  const urlForAddons = getAddonUrl(getExtraServerOption(options, 'addonsUrls') ?? {}, req)
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
      let jwtValue: JwtPayload = {}
      try {
        jwtValue = jwtDecode(token)
      } catch (error) {
        console.warn(
          NETLIFYDEVWARN,
          'Error while decoding JWT provided in request',
          error instanceof Error ? error.message : error?.toString(),
        )
        res.writeHead(400)
        res.end('Invalid JWT provided. Please see logs for more info.')
        return
      }

      if ((jwtValue.exp || 0) < Math.round(Date.now() / MILLISEC_TO_SEC)) {
        console.warn(NETLIFYDEVWARN, 'Expired JWT provided in request', req.url)
      } else {
        // I think through some circuitous callback logic `options.jwtRolePath` is guaranteed to
        // be defined at this point, but I don't think it's possible to convince TS of this.
        const presentedRoles = getProperty(jwtValue, getExtraServerOption(options, 'jwtRolePath')) ?? []
        if (!Array.isArray(presentedRoles)) {
          console.warn(
            NETLIFYDEVWARN,
            `Invalid roles value provided in JWT ${getExtraServerOption(options, 'jwtRolePath')}`,
            presentedRoles,
          )
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

  const staticFile = await getStatic(
    decodeURIComponent(reqUrl.pathname),
    getExtraServerOption(options, 'publicFolder') ?? '',
  )
  const endpointExists =
    !staticFile &&
    !isHiddenProxy &&
    process.env.NETLIFY_DEV_SERVER_CHECK_SSG_ENDPOINTS &&
    // @ts-expect-error(serhalp) -- TODO verify if the intent is that `options.target` is
    // always a string (if so, use `typeof` to only pass strings), or if this is implicitly
    // relying on built-in coercion to a string of the various support target URL-ish types.
    (await isEndpointExists(decodeURIComponent(reqUrl.pathname), getExtraServerOption(options, 'target')))
  if (staticFile || endpointExists) {
    const pathname = staticFile || reqUrl.pathname
    req.url = encodeURI(pathname) + reqUrl.search
    // if there is an existing static file and it is not a forced redirect, return the file
    if (!match.force) {
      return proxy.web(req, res, { ...options, staticFile })
    }
  }

  if (match.force || !staticFile || !getExtraServerOption(options, 'framework') || req.method === 'POST') {
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
      return proxy.web(req, res, { target: getExtraServerOption(options, 'functionsServer') })
    }

    const destStaticFile = await getStatic(dest.pathname, getExtraServerOption(options, 'functionsServer') ?? '')
    const matchingFunction =
      functionsRegistry &&
      (await functionsRegistry.getFunctionForURLPath(destURL, req.method, () => Boolean(destStaticFile)))
    let statusValue: number | undefined
    if (
      match.force ||
      (!staticFile &&
        ((!getExtraServerOption(options, 'framework') && destStaticFile) || isInternal(destURL) || matchingFunction))
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

      return proxy.web(req, res, { headers: functionHeaders, target: getExtraServerOption(options, 'functionsServer') })
    }
    if (isImageRequest(req)) {
      return imageProxy(req, res)
    }
    const addonUrl = getAddonUrl(getExtraServerOption(options, 'addonsUrls') ?? {}, req)
    if (addonUrl) {
      return handleAddonUrl({ req, res, addonUrl })
    }

    return proxy.web(req, res, { ...options, status: statusValue })
  }

  return proxy.web(req, res, options)
}

const reqToURL = function (req: IncomingMessage, pathname: undefined | string) {
  return new URL(
    pathname ?? '',
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
}: { config: NetlifyOptions['config'] } & Record<string, $TSFixMe>) {
  const proxy = httpProxy.createProxyServer({
    selfHandleResponse: true,
    target: {
      host,
      port,
    },
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

  // @ts-expect-error TS(2339) FIXME: Property 'on' does not exist on type 'ProxyServer'. Remove this comment to see the full error message
  proxy.before('web', 'stream', (req: IncomingMessage) => {
    // See https://github.com/http-party/node-http-proxy/issues/1219#issuecomment-511110375
    if (req.headers.expect) {
      req.__expectHeader = req.headers.expect
      delete req.headers.expect
    }
  })

  proxy.on('error', (_, req, res) => {
    // @ts-expect-error TS(2339) FIXME: Property 'writeHead' does not exist on type 'Socke... Remove this comment to see the full error message
    res.writeHead(500, {
      'Content-Type': 'text/plain',
    })

    const message = isEdgeFunctionsRequest(req)
      ? 'There was an error with an Edge Function. Please check the terminal for more details.'
      : 'Could not proxy request.'

    res.end(message)
  })
  proxy.on('proxyReq', (proxyReq: ClientRequest, req: IncomingMessage, _res: unknown, _opts: unknown) => {
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
  proxy.on('proxyRes', (proxyRes: IncomingMessage, req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('server', 'Netlify')

    const requestID = req.headers[NFRequestID]

    if (requestID) {
      res.setHeader(NFRequestID, requestID)
    }

    if (proxyRes.statusCode === 404 || proxyRes.statusCode === 403) {
      // If a request for `/path` has failed, we'll a few variations like
      // `/path/index.html` to mimic the CDN behavior.
      if (req.alternativePaths && req.alternativePaths.length !== 0) {
        req.url = req.alternativePaths.shift()
        return proxy.web(req, res, req.proxyOptions)
      }

      // The request has failed but we might still have a matching redirect
      // rule (without `force`) that should kick in. This is how we mimic the
      // file shadowing behavior from the CDN.
      if (req.proxyOptions?.match) {
        return serveRedirect({
          // We don't want to match functions at this point because any redirects
          // to functions will have already been processed, so we don't supply a
          // functions registry to `serveRedirect`.
          functionsRegistry: null,
          req,
          res,
          proxy: handlers,
          imageProxy,
          match: req.proxyOptions.match,
          options: req.proxyOptions,
          siteInfo,
          env,
        })
      }
    }

    // @ts-expect-error(serhalp) -- This makes absolutely no sense. Take a deep breath and investigate.
    if (req.proxyOptions.staticFile && isRedirect({ status: proxyRes.statusCode }) && proxyRes.headers.location) {
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
        options: req.proxyOptions,
        siteInfo,
        env,
      })
    }

    const responseData: Uint8Array[] = []
    const requestURL = new URL(req.url ?? '', `http://${req.headers.host || '127.0.0.1'}`)
    const headersRules = headersForPath(headers, requestURL.pathname)

    const htmlInjections =
      config.dev?.processing?.html?.injections &&
      config.dev.processing.html.injections.length !== 0 &&
      proxyRes.headers?.['content-type']?.startsWith('text/html')
        ? config.dev.processing.html.injections
        : undefined

    // for streamed responses, we can't do etag generation nor error templates.
    // we'll just stream them through!
    // when html_injections are present in dev config, we can't use streamed response
    const isStreamedResponse = proxyRes.headers['content-length'] === undefined
    if (isStreamedResponse && !htmlInjections) {
      Object.entries(headersRules).forEach(([key, val]) => {
        // @ts-expect-error TS(2345) FIXME: Argument of type 'unknown' is not assignable to pa... Remove this comment to see the full error message
        res.setHeader(key, val)
      })
      res.writeHead(req.proxyOptions.status ?? proxyRes.statusCode ?? 200, proxyRes.headers)

      proxyRes.on('data', function onData(data) {
        res.write(data)
      })

      proxyRes.on('end', function onEnd() {
        res.end()
      })

      return
    }

    proxyRes.on('data', function onData(data) {
      responseData.push(data as Uint8Array)
    })

    proxyRes.on('end', async function onEnd() {
      let responseBody = Buffer.concat(responseData)

      let responseStatus = req.proxyOptions.status || proxyRes.statusCode

      // `req[shouldGenerateETag]` may contain a function that determines
      // whether the response should have an ETag header.
      const shouldGenerateETag = getShouldGenerateETag(req)
      if (typeof shouldGenerateETag === 'function' && shouldGenerateETag({ statusCode: responseStatus }) === true) {
        const etag = generateETag(responseBody, { weak: true })

        if (req.headers['if-none-match'] === etag) {
          responseStatus = 304
        }

        res.setHeader('etag', etag)
      }

      Object.entries(headersRules).forEach(([key, val]) => {
        // @ts-expect-error TS(2345) FIXME: Argument of type 'unknown' is not assignable to pa... Remove this comment to see the full error message
        res.setHeader(key, val)
      })

      const isUncaughtError = proxyRes.headers['x-nf-uncaught-error'] === '1'

      if (isEdgeFunctionsRequest(req) && isUncaughtError) {
        const acceptsHtml = req.headers?.accept?.includes('text/html') ?? false
        const decompressedBody = await decompressResponseBody(responseBody, proxyRes.headers['content-encoding'])
        const formattedBody = formatEdgeFunctionError(decompressedBody, acceptsHtml)
        const errorResponse = acceptsHtml
          ? await renderErrorTemplate(formattedBody, '../../src/lib/templates/function-error.html', 'edge function')
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

      res.writeHead(responseStatus ?? 200, proxyResHeaders)

      if (responseStatus !== 304) {
        res.write(responseBody)
      }

      res.end()
    })
  })

  const handlers = {
    web: (req: IncomingMessage, res: ServerResponse, options: IncomingMessage['proxyOptions']) => {
      const requestURL = new URL(req.url ?? '', 'http://127.0.0.1')
      req.proxyOptions = options
      req.alternativePaths = alternativePathsFor(requestURL.pathname).map((filePath) => filePath + requestURL.search)
      // Ref: https://nodejs.org/api/net.html#net_socket_remoteaddress
      req.headers['x-forwarded-for'] = req.socket.remoteAddress || ''
      return proxy.web(req, res, options)
    },
    ws: (
      req: IncomingMessage,
      socket: Duplex,
      head: Buffer,
      options: {
        target?: string
        changeOrigin?: boolean
        pathRewrite?: () => string
      },
    ) => proxy.ws(req, socket, head, options),
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
    settings,
    siteInfo,
  }: {
    addonsUrls: Record<string, string>
    rewriter: Rewriter
    settings: ServerSettings
    edgeFunctionsProxy?: EdgeFunctionsProxy
  } & Record<string, $TSFixMe>,
  req: IncomingMessage,
  res: ServerResponse,
) => {
  req.originalBody =
    req.method && ['GET', 'OPTIONS', 'HEAD'].includes(req.method) ? null : await createStreamPromise(req, BYTES_LIMIT)

  if (isImageRequest(req)) {
    return imageProxy(req, res)
  }

  const edgeFunctionsProxyURL = await edgeFunctionsProxy?.(req as any)

  if (edgeFunctionsProxyURL !== undefined) {
    return proxy.web(req, res, { target: edgeFunctionsProxyURL })
  }

  const functionMatch =
    functionsRegistry &&
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
    return handleAddonUrl({ req, res, addonUrl })
  }

  const match = await rewriter(req)
  const options = {
    match,
    addonsUrls,
    target: `http://${
      settings.frameworkHost && isIPv6(settings.frameworkHost) ? `[${settings.frameworkHost}]` : settings.frameworkHost
    }:${settings.frameworkPort}`,
    publicFolder: settings.dist,
    functionsServer,
    functionsPort: settings.functionsPort,
    jwtRolePath: settings.jwtRolePath,
    framework: settings.framework,
  }

  if (match) {
    // We don't want to generate an ETag for 3xx redirects.
    setShouldGenerateETag(req, ({ statusCode }: { statusCode: number }) => statusCode < 300 || statusCode >= 400)

    return serveRedirect({ req, res, proxy, imageProxy, match, options, siteInfo, env, functionsRegistry })
  }

  // The request will be served by the framework server, which means we want to
  // generate an ETag unless we're rendering an error page. The only way for
  // us to know that is by looking at the status code
  setShouldGenerateETag(req, ({ statusCode }: { statusCode: number }) => statusCode >= 200 && statusCode < 300)

  const hasFormSubmissionHandler: boolean =
    functionsRegistry && getFormHandler({ functionsRegistry, logWarning: false })

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

  if (req.method === 'GET' && api && process.env.NETLIFY_DEV_SERVER_ID) {
    notifyActivity(api, siteInfo.id, process.env.NETLIFY_DEV_SERVER_ID)
  }

  proxy.web(req, res, options)
}

export const getProxyUrl = function (settings: Pick<ServerSettings, 'https' | 'port'>) {
  const scheme = settings.https ? 'https' : 'http'
  return `${scheme}://localhost:${settings.port}`
}

type EdgeFunctionsProxy = Awaited<ReturnType<typeof initializeEdgeFunctionsProxy>>

export const startProxy = async function ({
  accountId,
  addonsUrls,
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
}: {
  addonsUrls: Record<string, string>
  command: BaseCommand
  settings: ServerSettings
  disableEdgeFunctions: boolean
} & Record<string, $TSFixMe>) {
  const secondaryServerPort = settings.https ? await getAvailablePort() : null
  const functionsServer = settings.functionsPort ? `http://127.0.0.1:${settings.functionsPort}` : null

  let edgeFunctionsProxy: EdgeFunctionsProxy | undefined
  if (disableEdgeFunctions) {
    log(
      NETLIFYDEVWARN,
      'Edge functions are disabled. Run without the --internal-disable-edge-functions flag to enable them.',
    )
  } else {
    edgeFunctionsProxy = await initializeEdgeFunctionsProxy({
      command,
      blobsContext,
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
      accountId,
      state,
    })
  }

  const imageProxy = await initializeImageProxy({
    config,
    settings,
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
  const onUpgrade = async function onUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    const match = await rewriter(req)
    if (match && !match.force404 && isExternal(match)) {
      const reqUrl = reqToURL(req, req.url)
      const dest = new URL(match.to, `${reqUrl.protocol}//${reqUrl.host}`)
      const destURL = stripOrigin(dest)
      return proxy.ws(req, socket, head, { target: dest.origin, changeOrigin: true, pathRewrite: () => destURL })
    }
    return proxy.ws(req, socket, head, {})
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
