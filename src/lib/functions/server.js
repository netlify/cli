const jwtDecode = require('jwt-decode')

const { error: errorExit, log } = require('../../utils/command-helpers')
const { getInternalFunctionsDir } = require('../../utils/functions')
const { NETLIFYDEVERR, NETLIFYDEVLOG } = require('../../utils/logo')

const { v4: uuidv4 } = require('uuid');

const { handleBackgroundFunction, handleBackgroundFunctionResult } = require('./background')
const { createFormSubmissionHandler } = require('./form-submissions-handler')
const { FunctionsRegistry } = require('./registry')
const { handleSynchronousFunction } = require('./synchronous')
const { shouldBase64Encode } = require('./utils')

const streamerCallbackHost = 'streamingresponses.netlify.app'

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

const streams = {}

const createHandler = function ({ functionsRegistry, functionsPort }) {
  return async function handler(request, response) {
    // handle proxies without path re-writes (http-servr)
    const cleanPath = request.path.replace(/^\/.netlify\/(functions|builders|streamers)/, '')
    const functionName = cleanPath.split('/').find(Boolean)
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

    const isBase64Encoded = shouldBase64Encode(request.headers['content-type'])
    const body = request.get('content-length') ? request.body.toString(isBase64Encoded ? 'base64' : 'utf8') : undefined

    let remoteAddress = request.get('x-forwarded-for') || request.connection.remoteAddress || ''
    remoteAddress = remoteAddress
      .split(remoteAddress.includes('.') ? ':' : ',')
      .pop()
      .trim()

    let requestPath = request.path
    if (request.get('x-netlify-original-pathname')) {
      requestPath = request.get('x-netlify-original-pathname')
      delete request.headers['x-netlify-original-pathname']
    }
    const queryParams = Object.entries(request.query).reduce(
      (prev, [key, value]) => ({ ...prev, [key]: Array.isArray(value) ? value : [value] }),
      {},
    )
    const headers = Object.entries({ ...request.headers, 'client-ip': [remoteAddress] }).reduce(
      (prev, [key, value]) => ({ ...prev, [key]: Array.isArray(value) ? value : [value] }),
      {},
    )
    const host = request.get('host') || 'localhost'
    const rawUrl = `${request.protocol}://${host}${request.originalUrl}`
    const rawQuery = new URLSearchParams(request.query).toString()
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
    }

    const clientContext = buildClientContext(request.headers) || {}

    const isStreamer = /^\/.netlify\/streamers\/?/.test(request.path)

    if (func.isBackground || isStreamer) {
      if (isStreamer) {
        const id = uuidv4()
        streams[id] = {response}
        event.streaming_response = {
          callback_url: `http://streamingresponses.netlify.app:${functionsPort}/callbacks/${id}`,
          target_ipv4: '127.0.0.1'
        }
      } else {
        handleBackgroundFunction(functionName, response)
      }

      const { error } = await func.invoke(event, clientContext)

      handleBackgroundFunctionResult(functionName, error)
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

      handleSynchronousFunction(error, result, response)
    }
  }
}

const streamerMiddleware = async (req, res, next) => {
  if (req.hostname === streamerCallbackHost) {
    const match = req.path.match(/^\/callbacks\/([a-z0-9-]+)\/?/)
    const id = match && match[1]
    const stream = streams[id]

    const headers = {}
    for (const key in req.headers) {
      if (/^s-/.test(key)) {
        headers[key.replace(/^s-/,'')] = req.headers[key]
      }
    }
    stream.response.headers = headers

    let l = 0
    for await (const chunk of req) {
      l += chunk.length
      stream.response.write(chunk)
    }

    stream.response.end()
    delete streams[id]

    res.send(`Wrote ${l} bytes to UA\n`)
    return
  }

  next()
}

const getFunctionsServer = function ({ buildersPrefix, functionsPrefix, functionsRegistry, siteUrl, functionsPort }) {
  // performance optimization, load express on demand
  // eslint-disable-next-line node/global-require
  const express = require('express')
  // eslint-disable-next-line node/global-require
  const expressLogging = require('express-logging')
  const app = express()
  const functionHandler = createHandler({ functionsRegistry, functionsPort })

  app.set('query parser', 'simple')

  app.use(
    express.text({
      limit: '6mb',
      type: ['text/*', 'application/json'],
    }),
  )
  app.use(express.raw({ limit: '6mb', type: '*/*' }))
  app.use(streamerMiddleware)
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

const startFunctionsServer = async ({
  buildersPrefix = '',
  capabilities,
  config,
  functionsPrefix = '',
  settings,
  site,
  siteUrl,
  timeouts,
}) => {
  const internalFunctionsDir = await getInternalFunctionsDir({ base: site.root })

  // The order of the function directories matters. Leftmost directories take
  // precedence.
  const functionsDirectories = [settings.functions, internalFunctionsDir].filter(Boolean)

  if (functionsDirectories.length !== 0) {
    const functionsRegistry = new FunctionsRegistry({
      capabilities,
      config,
      projectRoot: site.root,
      timeouts,
    })

    await functionsRegistry.scan(functionsDirectories)

    const server = getFunctionsServer({
      functionsRegistry,
      siteUrl,
      functionsPrefix,
      buildersPrefix,
      functionsPort: settings.functionsPort
    })

    await startWebServer({ server, settings })
  }
}

const startWebServer = async ({ server, settings }) => {
  await new Promise((resolve) => {
    server.listen(settings.functionsPort, (err) => {
      if (err) {
        errorExit(`${NETLIFYDEVERR} Unable to start functions server: ${err}`)
      } else {
        log(`${NETLIFYDEVLOG} Functions server is listening on ${settings.functionsPort}`)
      }
      resolve()
    })
  })
}

module.exports = { startFunctionsServer }
