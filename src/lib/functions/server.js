const bodyParser = require('body-parser')
const jwtDecode = require('jwt-decode')
const lambdaLocal = require('lambda-local')
const winston = require('winston')

const { NETLIFYDEVERR, NETLIFYDEVLOG } = require('../../utils/logo')

const { executeBackgroundFunction } = require('./background')
const { setupDefaultFunctionHandler, setupFunctionsBuilder } = require('./builder')
const { createFormSubmissionHandler } = require('./form-submissions-handler')
const { executeSynchronousFunction } = require('./synchronous')
const { shouldBase64Encode } = require('./utils')

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
  } catch (_) {
    // Ignore errors - bearer token is not a JWT, probably not intended for us
  }
}

const createHandler = function ({ getFunctionByName, timeouts }) {
  const logger = winston.createLogger({
    levels: winston.config.npm.levels,
    transports: [new winston.transports.Console({ level: 'warn' })],
  })
  lambdaLocal.setLogger(logger)

  return function handler(request, response) {
    // handle proxies without path re-writes (http-servr)
    const cleanPath = request.path.replace(/^\/.netlify\/functions/, '')

    const functionName = cleanPath.split('/').find(Boolean)
    const func = getFunctionByName(functionName)
    if (func === undefined) {
      response.statusCode = 404
      response.end('Function not found...')
      return
    }
    const { bundleFile, mainFile, isBackground } = func
    const lambdaPath = bundleFile || mainFile

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
    }

    const clientContext = JSON.stringify(buildClientContext(request.headers) || {})

    if (isBackground) {
      return executeBackgroundFunction({
        event,
        lambdaPath,
        timeout: timeouts.backgroundFunctions,
        clientContext,
        response,
        functionName,
      })
    }

    return executeSynchronousFunction({
      event,
      lambdaPath,
      timeout: timeouts.syncFunctions,
      clientContext,
      response,
    })
  }
}

const getFunctionsServer = async function ({ getFunctionByName, siteUrl, warn, timeouts, prefix }) {
  // performance optimization, load express on demand
  // eslint-disable-next-line node/global-require
  const express = require('express')
  // eslint-disable-next-line node/global-require
  const expressLogging = require('express-logging')
  const app = express()
  app.set('query parser', 'simple')

  app.use(
    bodyParser.text({
      limit: '6mb',
      type: ['text/*', 'application/json'],
    }),
  )
  app.use(bodyParser.raw({ limit: '6mb', type: '*/*' }))
  app.use(createFormSubmissionHandler({ getFunctionByName, siteUrl, warn }))
  app.use(
    expressLogging(console, {
      blacklist: ['/favicon.ico'],
    }),
  )

  app.get('/favicon.ico', function onRequest(req, res) {
    res.status(204).end()
  })

  app.all(`${prefix}*`, await createHandler({ getFunctionByName, timeouts }))

  return app
}

const startFunctionsServer = async ({
  config,
  settings,
  site,
  log,
  warn,
  errorExit,
  siteUrl,
  capabilities,
  timeouts,
  prefix = '',
}) => {
  // serve functions from zip-it-and-ship-it
  // env variables relies on `url`, careful moving this code
  if (settings.functions) {
    const builder = await setupFunctionsBuilder({
      config,
      errorExit,
      functionsDirectory: settings.functions,
      log,
      site,
    })
    const directory = builder.target || settings.functions

    // If the functions builder implements a `getFunctionByName` function, it
    // will be called on every functions request with the function name and it
    // should return the corresponding function object if one exists.
    const { getFunctionByName } =
      typeof builder.getFunctionByName === 'function'
        ? builder
        : await setupDefaultFunctionHandler({ capabilities, directory, warn })
    const server = await getFunctionsServer({
      getFunctionByName,
      siteUrl,
      warn,
      timeouts,
      prefix,
    })

    await startWebServer({ server, settings, log, errorExit })
  }
}

const startWebServer = async ({ server, settings, log, errorExit }) => {
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
