import { Buffer } from 'buffer'
import { promises as fs } from 'fs'
import type { IncomingHttpHeaders } from 'http'
import path from 'path'

import type { GeneratedFunction } from '@netlify/build'
import { shouldBase64Encode } from '@netlify/dev-utils'
import express, { type Request, type RequestHandler } from 'express'
import expressLogging from 'express-logging'
import { jwtDecode } from 'jwt-decode'

import type BaseCommand from '../../commands/base-command.js'
import type { NetlifySite } from '../../commands/types.js'
import { NETLIFYDEVLOG, type NormalizedCachedConfigConfig, log } from '../../utils/command-helpers.js'
import { UNLINKED_SITE_MOCK_ID } from '../../utils/dev.js'
import { isFeatureFlagEnabled } from '../../utils/feature-flags.js'
import {
  CLOCKWORK_USERAGENT,
  getFunctionsDistPath,
  getFunctionsServePath,
  getInternalFunctionsDir,
} from '../../utils/functions/index.js'
import { NFFunctionName, NFFunctionRoute } from '../../utils/headers.js'
import type { BlobsContextWithEdgeAccess } from '../blobs/blobs.js'
import { headers as efHeaders } from '../edge-functions/headers.js'
import { getGeoLocation } from '../geo-location.js'
import type { AIGatewayContext, LocalState, ServerSettings, SiteInfo } from '../../utils/types.js'

import { handleBackgroundFunction, handleBackgroundFunctionResult } from './background.js'
import { createFormSubmissionHandler } from './form-submissions-handler.js'
import { FunctionsRegistry } from './registry.js'
import { handleScheduledFunction } from './scheduled.js'
import { handleSynchronousFunction } from './synchronous.js'

type FunctionsSettings = Pick<ServerSettings, 'functions' | 'functionsPort'>

const buildClientContext = function (headers: IncomingHttpHeaders) {
  // inject a client context based on auth header, ported over from netlify-lambda (https://github.com/netlify/netlify-lambda/pull/57)
  if (!headers.authorization) return

  const parts = headers.authorization.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return

  const identity = {
    url: 'https://netlify-dev-locally-emulated-identity.netlify.app/.netlify/identity',
    token:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzb3VyY2UiOiJuZXRsaWZ5IGRldiIsInRlc3REYXRhIjoiTkVUTElGWV9ERVZfTE9DQUxMWV9FTVVMQVRFRF9JREVOVElUWSJ9.2eSDqUOZAOBsx39FHFePjYj12k0LrxldvGnlvDu3GMI',
    // you can decode this with https://jwt.io/
    // just says
    // {
    //   "source": "netlify dev",
    //   "testData": "NETLIFY_DEV_LOCALLY_EMULATED_IDENTITY"
    // }
  }

  try {
    // This data is available on both the context root and under custom.netlify for retro-compatibility.
    // In the future it will only be available in custom.netlify.
    const user = jwtDecode(parts[1])

    const netlifyContext = JSON.stringify({
      identity,
      user,
    })

    return {
      identity,
      user,
      custom: {
        netlify: Buffer.from(netlifyContext).toString('base64'),
      },
    }
  } catch {
    // Ignore errors - bearer token is not a JWT, probably not intended for us
  }
}

const hasBody = (req: Request) =>
  // copied from is-type package
  (req.header('transfer-encoding') !== undefined || !Number.isNaN(Number(req.header('content-length')))) &&
  // we expect a string or a buffer, because we use the two bodyParsers(text, raw) from express
  (typeof req.body === 'string' || Buffer.isBuffer(req.body))

export const createHandler = function (options: GetFunctionsServerOptions): RequestHandler {
  const { functionsRegistry } = options

  return async function handler(request, response) {
    // If these headers are set, it means we've already matched a function and we
    // can just grab its name directly. We delete the header from the request
    // because we don't want to expose it to user code.
    let functionName = request.header(NFFunctionName)
    delete request.headers[NFFunctionName]
    const functionRoute = request.header(NFFunctionRoute)
    delete request.headers[NFFunctionRoute]

    // If there's still no function found, we check the functionsRegistry again.
    // This is needed for the functions:serve command, where the dev server that normally does the matching doesn't run.
    // It also matches the default URL (.netlify/functions/builders)
    if (!functionName) {
      const match = await functionsRegistry.getFunctionForURLPath(
        request.url,
        request.method,
        // we're pretending there's no static file at the same URL.
        // This is wrong, but in local dev we already did the matching
        // in a downstream server where we had access to the file system, so this never hits.
        () => Promise.resolve(false),
      )
      functionName = match?.func?.name
    }

    const func = functionsRegistry.get(functionName ?? '')

    if (func === undefined) {
      response.statusCode = 404
      response.end('Function not found...')
      return
    }

    // Technically it follows from `func.hasValidName()` that `functionName != null`, but TS doesn't know that.
    if (!func.hasValidName() || functionName == null) {
      response.statusCode = 400
      response.end('Function name should consist only of alphanumeric characters, hyphen & underscores.')
      return
    }

    const isBase64Encoded = shouldBase64Encode(request.header('content-type') ?? '')
    let body
    if (hasBody(request)) {
      body = request.body.toString(isBase64Encoded ? 'base64' : 'utf8')
    }

    let remoteAddress = request.header('x-forwarded-for') || request.connection.remoteAddress || ''
    remoteAddress =
      remoteAddress
        .split(remoteAddress.includes('.') ? ':' : ',')
        .pop()
        ?.trim() ?? ''

    const requestPath = request.header('x-netlify-original-pathname') ?? request.path
    delete request.headers['x-netlify-original-pathname']

    let requestQuery = request.query
    if (request.header('x-netlify-original-search')) {
      const newRequestQuery: Record<string, string[]> = {}
      const searchParams = new URLSearchParams(request.header('x-netlify-original-search'))

      for (const key of searchParams.keys()) {
        newRequestQuery[key] = searchParams.getAll(key)
      }

      requestQuery = newRequestQuery
      delete request.headers['x-netlify-original-search']
    }

    const queryParamsAsMultiValue: Record<string, string[]> = Object.entries(requestQuery).reduce(
      (prev, [key, value]) => ({ ...prev, [key]: Array.isArray(value) ? value : [value] }),
      {},
    )

    const geoLocation = await getGeoLocation({ ...options, mode: options.geolocationMode })

    const multiValueHeaders: Record<string, string[]> = Object.entries({
      ...request.headers,
      'client-ip': [remoteAddress],
      'x-nf-client-connection-ip': [remoteAddress],
      'x-nf-account-id': [options.accountId],
      'x-nf-site-id': [options.siteInfo?.id ?? UNLINKED_SITE_MOCK_ID],
      [efHeaders.Geo]: Buffer.from(JSON.stringify(geoLocation)).toString('base64'),
    }).reduce((prev, [key, value]) => ({ ...prev, [key]: Array.isArray(value) ? value : [value] }), {})
    const rawQuery = new URL(request.originalUrl, 'http://example.com').search.slice(1)
    // TODO(serhalp): Update several tests to pass realistic `config` objects and remove nullish coalescing.
    const protocol = options.config?.dev?.https ? 'https' : 'http'
    const url = new URL(requestPath, `${protocol}://${request.get('host') || 'localhost'}`)
    url.search = rawQuery
    const rawUrl = url.toString()
    const event = {
      path: requestPath,
      httpMethod: request.method,
      queryStringParameters: Object.entries(queryParamsAsMultiValue).reduce(
        (prev, [key, value]) => ({ ...prev, [key]: value.join(', ') }),
        {},
      ),
      multiValueQueryStringParameters: queryParamsAsMultiValue,
      headers: Object.entries(multiValueHeaders).reduce(
        (prev, [key, value]) => ({ ...prev, [key]: value.join(', ') }),
        {},
      ),
      multiValueHeaders,
      body,
      isBase64Encoded,
      rawUrl,
      rawQuery,
      route: functionRoute,
    }

    const clientContext = buildClientContext(request.headers) || {}

    if (func.isBackground) {
      handleBackgroundFunction(functionName, response)

      // background functions do not receive a clientContext
      const { error } = await func.invoke(event)

      handleBackgroundFunctionResult(functionName, error)
    } else if (await func.isScheduled()) {
      // In production, scheduled functions always receive POST requests, so we
      // have to emulate that here, even if a user has triggered a GET request
      // as part of their tests. If we don't do this, we'll hit problems when
      // we send the invocation body in a request that can't have a body.
      event.httpMethod = 'POST'

      const { error, result } = await func.invoke(
        {
          ...event,
          body: JSON.stringify({
            next_run: await func.getNextRun(),
          }),
          isBase64Encoded: false,
          headers: {
            ...event.headers,
            'user-agent': CLOCKWORK_USERAGENT,
            'X-NF-Event': 'schedule',
          },
        },
        clientContext,
      )

      handleScheduledFunction({
        error,
        request,
        response,

        // When we handle the result of invoking a scheduled function, we'll warn
        // people in case their function returned a body or headers, since those
        // will have no practical effect in production. However, in v2 functions
        // we don't currently have a good way of asserting whether the body we're
        // seeing has been actually produced by user code or by the bootstrap, so
        // we risk printing that warn unnecessarily, which causes more harm than
        // good. Until we find a way of making this detection better, ignore the
        // invocation result entirely for v2 functions.
        result: func.runtimeAPIVersion === 1 ? result : {},
      })
    } else {
      const { error, result } = await func.invoke(event, clientContext)

      // check for existence of metadata if this is a builder function
      // @ts-expect-error(serhalp) -- Investigate. There doesn't appear to be such a thing as `metadata`?
      if (/^\/.netlify\/(builders)/.test(request.path) && !result?.metadata?.builder_function) {
        response.status(400).send({
          message:
            'Function is not an on-demand builder. See https://ntl.fyi/create-builder for how to convert a function to a builder.',
        })
        response.end()
        return
      }

      await handleSynchronousFunction({ error, functionName: func.name, result, request, response })
    }
  }
}

interface GetFunctionsServerOptions {
  functionsRegistry: FunctionsRegistry
  siteUrl: string
  siteInfo?: SiteInfo
  accountId?: string | undefined
  geoCountry: string
  offline: boolean
  state: LocalState
  config: NormalizedCachedConfigConfig
  geolocationMode: 'cache' | 'update' | 'mock'
}

const getFunctionsServer = (options: GetFunctionsServerOptions) => {
  const { functionsRegistry, siteUrl } = options
  const app = express()
  const functionHandler = createHandler(options)

  app.set('query parser', 'simple')

  app.use(
    express.text({
      limit: '6mb',
      type: ['text/*', 'application/json'],
    }),
  )
  app.use(express.raw({ limit: '6mb', type: '*/*' }))
  app.use(createFormSubmissionHandler({ functionsRegistry, siteUrl }))
  app.use(
    expressLogging(console, {
      blacklist: ['/favicon.ico'],
    }),
  )

  app.all('*', functionHandler)

  return app
}

export const startFunctionsServer = async (
  options: {
    aiGatewayContext?: AIGatewayContext
    blobsContext: BlobsContextWithEdgeAccess
    command: BaseCommand
    config: NormalizedCachedConfigConfig
    capabilities: {
      backgroundFunctions?: boolean
    }
    debug: boolean
    generatedFunctions: GeneratedFunction[]
    loadDistFunctions?: boolean
    // TODO(serhalp): This is confusing. Refactor to accept entire settings or rename or something?
    settings: Pick<ServerSettings, 'functions' | 'functionsPort'>
    site: NetlifySite
    siteInfo: SiteInfo
    timeouts: { backgroundFunctions: number; syncFunctions: number }
  } & Omit<GetFunctionsServerOptions, 'functionsRegistry'>,
): Promise<FunctionsRegistry | undefined> => {
  const {
    aiGatewayContext,
    blobsContext,
    capabilities,
    command,
    config,
    debug,
    generatedFunctions,
    loadDistFunctions,
    settings,
    site,
    siteInfo,
    siteUrl,
    timeouts,
  } = options
  const internalFunctionsDir = await getInternalFunctionsDir({ base: site.root, packagePath: command.workspacePackage })
  const functionsDirectories: string[] = []
  let manifest

  // If the `loadDistFunctions` parameter is sent, the functions server will
  // use the built functions created by zip-it-and-ship-it rather than building
  // them from source.
  if (loadDistFunctions) {
    const distPath = await getFunctionsDistPath({ base: site.root, packagePath: command.workspacePackage })

    if (distPath) {
      functionsDirectories.push(distPath)

      // When using built functions, read the manifest file so that we can
      // extract metadata such as routes and API version.
      try {
        const manifestPath = path.join(distPath, 'manifest.json')
        const data = await fs.readFile(manifestPath, 'utf8')

        manifest = JSON.parse(data)
      } catch {
        // no-op
      }
    }
  } else {
    // The order of the function directories matters. Rightmost directories take
    // precedence.
    const sourceDirectories: string[] = [
      internalFunctionsDir,
      command.netlify.frameworksAPIPaths.functions.path,
      settings.functions,
    ].filter((x): x is string => x != null)

    functionsDirectories.push(...sourceDirectories)
  }

  try {
    const functionsServePath = getFunctionsServePath({ base: site.root, packagePath: command.workspacePackage })

    await fs.rm(functionsServePath, { force: true, recursive: true })
  } catch {
    // no-op
  }

  if (functionsDirectories.length === 0) {
    return
  }

  const functionsRegistry = new FunctionsRegistry({
    aiGatewayContext,
    blobsContext,
    capabilities,
    config,
    debug,
    frameworksAPIPaths: command.netlify.frameworksAPIPaths,
    generatedFunctions,
    isConnected: Boolean(siteUrl),
    logLambdaCompat: isFeatureFlagEnabled('cli_log_lambda_compat', siteInfo),
    manifest,
    // functions always need to be inside the packagePath if set inside a monorepo
    projectRoot: command.workingDir,
    settings,
    timeouts,
  })

  await functionsRegistry.scan(functionsDirectories)

  const server = getFunctionsServer({ ...options, functionsRegistry })

  await startWebServer({ server, settings, debug })

  return functionsRegistry
}

const startWebServer = async ({
  debug,
  server,
  settings,
}: {
  debug: boolean
  server: ReturnType<Awaited<typeof getFunctionsServer>>
  settings: FunctionsSettings
}) => {
  await new Promise<void>((resolve) => {
    server.listen(settings.functionsPort, () => {
      if (debug) {
        log(`${NETLIFYDEVLOG} Functions server is listening on ${settings.functionsPort.toString()}`)
      }
      resolve()
    })
  })
}
