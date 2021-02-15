const { Buffer } = require('buffer')
const querystring = require('querystring')
const { Readable } = require('stream')
const { URL } = require('url')

const bodyParser = require('body-parser')
const chalk = require('chalk')
const chokidar = require('chokidar')
const { parse: parseContentType } = require('content-type')
const express = require('express')
const expressLogging = require('express-logging')
const jwtDecode = require('jwt-decode')
const lambdaLocal = require('lambda-local')
const debounce = require('lodash/debounce')
const multiparty = require('multiparty')
const getRawBody = require('raw-body')
const winston = require('winston')

const { getLogMessage } = require('../lib/log')

const { detectFunctionsBuilder } = require('./detect-functions-builder')
const { getFunctions } = require('./get-functions')
const { NETLIFYDEVLOG, NETLIFYDEVWARN, NETLIFYDEVERR } = require('./logo')

const formatLambdaLocalError = (err) => `${err.errorType}: ${err.errorMessage}\n  ${err.stackTrace.join('\n  ')}`

const handleErr = function (err, response) {
  response.statusCode = 500
  const errorString = typeof err === 'string' ? err : formatLambdaLocalError(err)
  response.end(errorString)
}

const formatLambdaError = (err) => chalk.red(`${err.errorType}: ${err.errorMessage}`)

const styleFunctionName = (name) => chalk.magenta(name)

const capitalize = function (t) {
  return t.replace(/(^\w|\s\w)/g, (string) => string.toUpperCase())
}

const validateLambdaResponse = (lambdaResponse) => {
  if (lambdaResponse === undefined) {
    return { error: 'lambda response was undefined. check your function code again' }
  }
  if (!Number(lambdaResponse.statusCode)) {
    return {
      error: `Your function response must have a numerical statusCode. You gave: $ ${lambdaResponse.statusCode}`,
    }
  }
  if (lambdaResponse.body && typeof lambdaResponse.body !== 'string') {
    return { error: `Your function response must have a string body. You gave: ${lambdaResponse.body}` }
  }

  return {}
}

const createSynchronousFunctionCallback = function (response) {
  return function callbackHandler(err, lambdaResponse) {
    if (err) {
      return handleErr(err, response)
    }

    const { error } = validateLambdaResponse(lambdaResponse)
    if (error) {
      console.log(`${NETLIFYDEVERR} ${error}`)
      return handleErr(error, response)
    }

    response.statusCode = lambdaResponse.statusCode
    for (const key in lambdaResponse.headers) {
      response.setHeader(key, lambdaResponse.headers[key])
    }
    for (const key in lambdaResponse.multiValueHeaders) {
      const items = lambdaResponse.multiValueHeaders[key]
      response.setHeader(key, items)
    }
    if (lambdaResponse.body) {
      response.write(lambdaResponse.isBase64Encoded ? Buffer.from(lambdaResponse.body, 'base64') : lambdaResponse.body)
    }
    response.end()
  }
}

const createBackgroundFunctionCallback = (functionName) => (err) => {
  if (err) {
    console.log(
      `${NETLIFYDEVERR} Error during background function ${styleFunctionName(functionName)} execution:`,
      formatLambdaError(err),
    )
  } else {
    console.log(`${NETLIFYDEVLOG} Done executing background function ${styleFunctionName(functionName)}`)
  }
}

const DEFAULT_LAMBDA_OPTIONS = {
  verboseLevel: 3,
}

// 10 seconds for synchronous functions
const SYNCHRONOUS_FUNCTION_TIMEOUT = 1e4
const executeSynchronousFunction = ({ event, lambdaPath, clientContext, response }) =>
  lambdaLocal.execute({
    ...DEFAULT_LAMBDA_OPTIONS,
    event,
    lambdaPath,
    clientContext,
    callback: createSynchronousFunctionCallback(response),
    timeoutMs: SYNCHRONOUS_FUNCTION_TIMEOUT,
  })

// 15 minuets for background functions
const BACKGROUND_FUNCTION_TIMEOUT = 9e5
const BACKGROUND_FUNCTION_STATUS_CODE = 202
const executeBackgroundFunction = ({ event, lambdaPath, clientContext, response, functionName }) => {
  console.log(`${NETLIFYDEVLOG} Queueing background function ${styleFunctionName(functionName)} for execution`)
  response.status(BACKGROUND_FUNCTION_STATUS_CODE)
  response.end()

  return lambdaLocal.execute({
    ...DEFAULT_LAMBDA_OPTIONS,
    event,
    lambdaPath,
    clientContext,
    callback: createBackgroundFunctionCallback(functionName),
    timeoutMs: BACKGROUND_FUNCTION_TIMEOUT,
  })
}

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

const clearCache = (action) => (path) => {
  console.log(`${NETLIFYDEVLOG} ${path} ${action}, reloading...`)
  Object.keys(require.cache).forEach((key) => {
    delete require.cache[key]
  })
  console.log(`${NETLIFYDEVLOG} ${path} ${action}, successfully reloaded!`)
}

const shouldBase64Encode = function (contentType) {
  return Boolean(contentType) && BASE_64_MIME_REGEXP.test(contentType)
}

const BASE_64_MIME_REGEXP = /image|audio|video|application\/pdf|application\/zip|applicaton\/octet-stream/i

const validateFunctions = function ({ functions, capabilities, warn }) {
  if (!capabilities.backgroundFunctions && functions.some(({ isBackground }) => isBackground)) {
    warn(getLogMessage('functions.backgroundNotSupported'))
  }
}

const createHandler = async function ({ dir, capabilities, warn }) {
  const functions = await getFunctions(dir)
  validateFunctions({ functions, capabilities, warn })
  const watcher = chokidar.watch(dir, { ignored: /node_modules/ })
  watcher.on('change', clearCache('modified')).on('unlink', clearCache('deleted'))

  const logger = winston.createLogger({
    levels: winston.config.npm.levels,
    transports: [new winston.transports.Console({ level: 'warn' })],
  })
  lambdaLocal.setLogger(logger)

  return function handler(request, response) {
    // handle proxies without path re-writes (http-servr)
    const cleanPath = request.path.replace(/^\/.netlify\/functions/, '')

    const functionName = cleanPath.split('/').find(Boolean)
    const func = functions.find(({ name }) => name === functionName)
    if (func === undefined) {
      response.statusCode = 404
      response.end('Function not found...')
      return
    }
    const { mainFile: lambdaPath, isBackground } = func

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
        clientContext,
        response,
        functionName,
      })
    }
    return executeSynchronousFunction({ event, lambdaPath, clientContext, response })
  }
}

const createFormSubmissionHandler = function ({ siteUrl }) {
  return async function formSubmissionHandler(req, res, next) {
    if (req.url.startsWith('/.netlify/') || req.method !== 'POST') return next()

    const fakeRequest = new Readable({
      read() {
        this.push(req.body)
        this.push(null)
      },
    })
    fakeRequest.headers = req.headers

    const originalUrl = new URL(req.url, 'http://localhost')
    req.url = `/.netlify/functions/submission-created${originalUrl.search}`

    const ct = parseContentType(req)
    let fields = {}
    let files = {}
    if (ct.type.endsWith('/x-www-form-urlencoded')) {
      const bodyData = await getRawBody(fakeRequest, {
        length: req.headers['content-length'],
        limit: '10mb',
        encoding: ct.parameters.charset,
      })
      fields = querystring.parse(bodyData.toString())
    } else if (ct.type === 'multipart/form-data') {
      try {
        ;[fields, files] = await new Promise((resolve, reject) => {
          const form = new multiparty.Form({ encoding: ct.parameters.charset || 'utf8' })
          form.parse(fakeRequest, (err, Fields, Files) => {
            if (err) return reject(err)
            Files = Object.entries(Files).reduce(
              (prev, [name, values]) => ({
                ...prev,
                [name]: values.map((value) => ({
                  filename: value.originalFilename,
                  size: value.size,
                  type: value.headers && value.headers['content-type'],
                  url: value.path,
                })),
              }),
              {},
            )
            return resolve([
              Object.entries(Fields).reduce(
                (prev, [name, values]) => ({ ...prev, [name]: values.length > 1 ? values : values[0] }),
                {},
              ),
              Object.entries(Files).reduce(
                (prev, [name, values]) => ({ ...prev, [name]: values.length > 1 ? values : values[0] }),
                {},
              ),
            ])
          })
        })
      } catch (error) {
        return console.error(error)
      }
    } else {
      return console.error('Invalid Content-Type for Netlify Dev forms request')
    }
    const data = JSON.stringify({
      payload: {
        company:
          fields[Object.keys(fields).find((name) => ['company', 'business', 'employer'].includes(name.toLowerCase()))],
        last_name:
          fields[Object.keys(fields).find((name) => ['lastname', 'surname', 'byname'].includes(name.toLowerCase()))],
        first_name:
          fields[
            Object.keys(fields).find((name) => ['firstname', 'givenname', 'forename'].includes(name.toLowerCase()))
          ],
        name: fields[Object.keys(fields).find((name) => ['name', 'fullname'].includes(name.toLowerCase()))],
        email:
          fields[
            Object.keys(fields).find((name) =>
              ['email', 'mail', 'from', 'twitter', 'sender'].includes(name.toLowerCase()),
            )
          ],
        title: fields[Object.keys(fields).find((name) => ['title', 'subject'].includes(name.toLowerCase()))],
        data: {
          ...fields,
          ...files,
          ip: req.connection.remoteAddress,
          user_agent: req.headers['user-agent'],
          referrer: req.headers.referer,
        },
        created_at: new Date().toISOString(),
        human_fields: Object.entries({
          ...fields,
          ...Object.entries(files).reduce((prev, [name, { url }]) => ({ ...prev, [name]: url }), {}),
        }).reduce((prev, [key, val]) => ({ ...prev, [capitalize(key)]: val }), {}),
        ordered_human_fields: Object.entries({
          ...fields,
          ...Object.entries(files).reduce((prev, [name, { url }]) => ({ ...prev, [name]: url }), {}),
        }).map(([key, val]) => ({ title: capitalize(key), name: key, value: val })),
        site_url: siteUrl,
      },
    })
    req.body = data
    req.headers = {
      ...req.headers,
      'content-length': data.length,
      'content-type': 'application/json',
      'x-netlify-original-pathname': originalUrl.pathname,
    }

    next()
  }
}

const getFunctionsServer = async function ({ dir, siteUrl, capabilities, warn }) {
  const app = express()
  app.set('query parser', 'simple')

  app.use(
    bodyParser.text({
      limit: '6mb',
      type: ['text/*', 'application/json'],
    }),
  )
  app.use(bodyParser.raw({ limit: '6mb', type: '*/*' }))
  app.use(createFormSubmissionHandler({ siteUrl }))
  app.use(
    expressLogging(console, {
      blacklist: ['/favicon.ico'],
    }),
  )

  app.get('/favicon.ico', function onRequest(req, res) {
    res.status(204).end()
  })

  app.all('*', await createHandler({ dir, capabilities, warn }))

  return app
}

const getBuildFunction = ({ functionBuilder, log }) =>
  async function build() {
    log(
      `${NETLIFYDEVLOG} Function builder ${chalk.yellow(functionBuilder.builderName)} ${chalk.magenta(
        'building',
      )} functions from directory ${chalk.yellow(functionBuilder.src)}`,
    )

    try {
      await functionBuilder.build()
      log(
        `${NETLIFYDEVLOG} Function builder ${chalk.yellow(functionBuilder.builderName)} ${chalk.green(
          'finished',
        )} building functions from directory ${chalk.yellow(functionBuilder.src)}`,
      )
    } catch (error) {
      const errorMessage = (error.stderr && error.stderr.toString()) || error.message
      log(
        `${NETLIFYDEVLOG} Function builder ${chalk.yellow(functionBuilder.builderName)} ${chalk.red(
          'failed',
        )} building functions from directory ${chalk.yellow(functionBuilder.src)}${
          errorMessage ? ` with error:\n${errorMessage}` : ''
        }`,
      )
    }
  }

const setupFunctionsBuilder = async ({ site, log, warn }) => {
  const functionBuilder = await detectFunctionsBuilder(site.root)
  if (functionBuilder) {
    log(
      `${NETLIFYDEVLOG} Function builder ${chalk.yellow(
        functionBuilder.builderName,
      )} detected: Running npm script ${chalk.yellow(functionBuilder.npmScript)}`,
    )
    warn(
      `${NETLIFYDEVWARN} This is a beta feature, please give us feedback on how to improve at https://github.com/netlify/cli/`,
    )

    const debouncedBuild = debounce(getBuildFunction({ functionBuilder, log }), 300, {
      leading: true,
      trailing: true,
    })

    await debouncedBuild()

    const functionWatcher = chokidar.watch(functionBuilder.src)
    functionWatcher.on('ready', () => {
      functionWatcher.on('add', debouncedBuild)
      functionWatcher.on('change', debouncedBuild)
      functionWatcher.on('unlink', debouncedBuild)
    })
  }
}

const startServer = async ({ server, settings, log, errorExit }) => {
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

const startFunctionsServer = async ({ settings, site, log, warn, errorExit, siteUrl, capabilities }) => {
  // serve functions from zip-it-and-ship-it
  // env variables relies on `url`, careful moving this code
  if (settings.functions) {
    await setupFunctionsBuilder({ site, log, warn })
    const server = await getFunctionsServer({ dir: settings.functions, siteUrl, capabilities, warn })
    await startServer({ server, settings, log, errorExit })
  }
}

module.exports = { startFunctionsServer }
