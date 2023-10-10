// @ts-check
import { Buffer } from 'buffer'
import { promises as fs } from 'fs'

import express from 'express'
import expressLogging from 'express-logging'
import jwtDecode from 'jwt-decode'

import { NETLIFYDEVERR, NETLIFYDEVLOG, error as errorExit, log } from '../../utils/command-helpers.mjs'
import { isFeatureFlagEnabled } from '../../utils/feature-flags.mjs'
import {
  CLOCKWORK_USERAGENT,
  getFunctionsDistPath,
  getFunctionsServePath,
  getInternalFunctionsDir,
} from '../../utils/functions/index.mjs'
import { NFFunctionName, NFFunctionRoute } from '../../utils/headers.mjs'
import { headers as efHeaders } from '../edge-functions/headers.mjs'
import { getGeoLocation } from '../geo-location.mjs'

import { handleBackgroundFunction, handleBackgroundFunctionResult } from './background.mjs'
import { createFormSubmissionHandler } from './form-submissions-handler.mjs'
import { FunctionsRegistry } from './registry.mjs'
import { handleScheduledFunction } from './scheduled.mjs'
import { handleSynchronousFunction } from './synchronous.mjs'
import { shouldBase64Encode } from './utils.mjs'

const buildClientContext = function (headers) {
  // inject a client context based on auth header, ported over from netlify-lambda (https://github.com/netlify/netlify-lambda/pull/57)
  if (!headers.authorization) return

  const parts = headers.authorization.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return

  try {
    return {
      identity: {
        url: 'https://netlify-dev-locally-emulated-identity.netlify.com/.netlify/identity',
        token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzb3VyY2UiOiJuZXRsaWZ5IGRldiIsInRlc3REYXRhIjoiTkVUTElGWV9ERVZfTE9DQUxMWV9FTVVMQVRFRF9JREVOVElUWSJ9.2eSDqUOZAOBsx39FHFePjYj12k0LrxldvGnlvDu3GMI',
        // you can decode this with https://jwt.io/
        // just says
        // {
        //   "source": "netlify dev",
        //   "testData": "NETLIFY_DEV_LOCALLY_EMULATED_IDENTITY"
        // }
      },
      user: jwtDecode(parts[1]),
    }
  } catch {
    // Ignore errors - bearer token is not a JWT, probably not intended for us
  }
}

const hasBody = (req) =>
  // copied from is-type package
  // eslint-disable-next-line unicorn/prefer-number-properties
  (req.header('transfer-encoding') !== undefined || !isNaN(req.header('content-length'))) &&
  // we expect a string or a buffer, because we use the two bodyParsers(text, raw) from express
  (typeof req.body === 'string' || Buffer.isBuffer(req.body))

export const createHandler = function (options) {
  const { functionsRegistry } = options

  return async function handler(request, response) {
    // If these headers are set, it means we've already matched a function and we
    // can just grab its name directly. We delete the header from the request
    // because we don't want to expose it to user code.
    let functionName = request.header(NFFunctionName)
    delete request.headers[NFFunctionName]
    const functionRoute = request.header(NFFunctionRoute)
    delete request.headers[NFFunctionRoute]

    // If we didn't match a function with a custom route, let's try to match
    // using the fixed URL format.
    if (!functionName) {
      const cleanPath = request.path.replace(/^\/.netlify\/(functions|builders)/, '')

      functionName = cleanPath.split('/').find(Boolean)
    }

    const func = functionsRegistry.get(functionName)

    if (func === undefined) {
      response.statusCode = 404
      response.end('Function not found...')
      return
    }

    if (!func.hasValidName()) {
      response.statusCode = 400
      response.end('Function name should consist only of alphanumeric characters, hyphen & underscores.')
      return
    }

    const isBase64Encoded = shouldBase64Encode(request.header('content-type'))
    let body
    if (hasBody(request)) {
      body = request.body.toString(isBase64Encoded ? 'base64' : 'utf8')
    }

    let remoteAddress = request.header('x-forwarded-for') || request.connection.remoteAddress || ''
    remoteAddress = remoteAddress
      .split(remoteAddress.includes('.') ? ':' : ',')
      .pop()
      .trim()

    let requestPath = request.path
    if (request.header('x-netlify-original-pathname')) {
      requestPath = request.header('x-netlify-original-pathname')
      delete request.headers['x-netlify-original-pathname']
    }

    let requestQuery = request.query
    if (request.header('x-netlify-original-search')) {
      const newRequestQuery = {}
      const searchParams = new URLSearchParams(request.header('x-netlify-original-search'))

      for (const key of searchParams.keys()) {
        newRequestQuery[key] = searchParams.getAll(key)
      }

      requestQuery = newRequestQuery
      delete request.headers['x-netlify-original-search']
    }

    const queryParams = Object.entries(requestQuery).reduce(
      (prev, [key, value]) => ({ ...prev, [key]: Array.isArray(value) ? value : [value] }),
      {},
    )

    const geoLocation = await getGeoLocation({ ...options, mode: options.geo })

    const headers = Object.entries({
      ...request.headers,
      'client-ip': [remoteAddress],
      'x-nf-client-connection-ip': [remoteAddress],
      'x-nf-account-id': [options.accountId],
      [efHeaders.Geo]: Buffer.from(JSON.stringify(geoLocation)).toString('base64'),
    }).reduce((prev, [key, value]) => ({ ...prev, [key]: Array.isArray(value) ? value : [value] }), {})
    const rawQuery = new URLSearchParams(requestQuery).toString()
    const protocol = options.config?.dev?.https ? 'https' : 'http'
    const url = new URL(requestPath, `${protocol}://${request.get('host') || 'localhost'}`)
    url.search = rawQuery
    const rawUrl = url.toString()
    const event = {
      path: requestPath,
      httpMethod: request.method,
      queryStringParameters: Object.entries(queryParams).reduce(
        (prev, [key, value]) => ({ ...prev, [key]: value.join(', ') }),
        {},
      ),
      multiValueQueryStringParameters: queryParams,
      headers: Object.entries(headers).reduce((prev, [key, value]) => ({ ...prev, [key]: value.join(', ') }), {}),
      multiValueHeaders: headers,
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
        result,
        request,
        response,
      })
    } else {
      const { error, result } = await func.invoke(event, clientContext)

      // check for existence of metadata if this is a builder function
      if (/^\/.netlify\/(builders)/.test(request.path) && (!result.metadata || !result.metadata.builder_function)) {
        response.status(400).send({
          message:
            'Function is not an on-demand builder. See https://ntl.fyi/create-builder for how to convert a function to a builder.',
        })
        response.end()
        return
      }

      handleSynchronousFunction({ error, functionName: func.name, result, request, response })
    }
  }
}

const getFunctionsServer = (options) => {
  const { buildersPrefix = '', functionsPrefix = '', functionsRegistry, siteUrl } = options
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

  app.get('/favicon.ico', function onRequest(_req, res) {
    res.status(204).end()
  })

  app.all(`${functionsPrefix}*`, functionHandler)
  app.all(`${buildersPrefix}*`, functionHandler)

  return app
}

/**
 *
 * @param {object} options
 * @param {import('../../commands/base-command.mjs').default} options.command
 * @param {*} options.capabilities
 * @param {*} options.config
 * @param {boolean} options.debug
 * @param {*} options.loadDistFunctions
 * @param {*} options.settings
 * @param {*} options.site
 * @param {*} options.siteInfo
 * @param {string} options.siteUrl
 * @param {*} options.timeouts
 * @returns {Promise<import('./registry.mjs').FunctionsRegistry | undefined>}
 */
export const startFunctionsServer = async (options) => {
  const { capabilities, command, config, debug, loadDistFunctions, settings, site, siteInfo, siteUrl, timeouts } =
    options
  const internalFunctionsDir = await getInternalFunctionsDir({ base: site.root })
  const functionsDirectories = []

  // If the `loadDistFunctions` parameter is sent, the functions server will
  // use the built functions created by zip-it-and-ship-it rather than building
  // them from source.
  if (loadDistFunctions) {
    const distPath = await getFunctionsDistPath({ base: site.root })

    if (distPath) {
      functionsDirectories.push(distPath)
    }
  } else {
    // The order of the function directories matters. Rightmost directories take
    // precedence.
    const sourceDirectories = [internalFunctionsDir, settings.functions].filter(Boolean)

    functionsDirectories.push(...sourceDirectories)
  }

  try {
    const functionsServePath = getFunctionsServePath({ base: site.root })

    await fs.rm(functionsServePath, { force: true, recursive: true })
  } catch {
    // no-op
  }

  if (functionsDirectories.length === 0) {
    return
  }

  const functionsRegistry = new FunctionsRegistry({
    capabilities,
    config,
    debug,
    isConnected: Boolean(siteUrl),
    logLambdaCompat: isFeatureFlagEnabled('cli_log_lambda_compat', siteInfo),
    // functions always need to be inside the packagePath if set inside a monorepo
    projectRoot: command.workingDir,
    settings,
    timeouts,
  })

  await functionsRegistry.scan(functionsDirectories)

  const server = getFunctionsServer(Object.assign(options, { functionsRegistry }))

  await startWebServer({ server, settings, debug })

  return functionsRegistry
}

/**
 *
 * @param {object} config
 * @param {boolean} config.debug
 * @param {ReturnType<Awaited<typeof getFunctionsServer>>} config.server
 * @param {*} config.settings
 */
const startWebServer = async ({ debug, server, settings }) => {
  await new Promise((/** @type {(resolve: void) => void} */ resolve) => {
    server.listen(settings.functionsPort, (/** @type {unknown} */ err) => {
      if (err) {
        errorExit(`${NETLIFYDEVERR} Unable to start functions server: ${err}`)
      } else if (debug) {
        log(`${NETLIFYDEVLOG} Functions server is listening on ${settings.functionsPort}`)
      }
      resolve()
    })
  })
}
