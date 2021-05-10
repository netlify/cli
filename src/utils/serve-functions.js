const { Buffer } = require('buffer')
const { relative } = require('path')
const { cwd } = require('process')
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
const { getFunctionsAndWatchDirs } = require('./get-functions')
const { NETLIFYDEVLOG, NETLIFYDEVERR } = require('./logo')

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
const SECONDS_TO_MILLISECONDS = 1000

const DEFAULT_LAMBDA_OPTIONS = {
  verboseLevel: 3,
}

const executeSynchronousFunction = ({ event, lambdaPath, timeout, clientContext, response }) =>
  lambdaLocal.execute({
    ...DEFAULT_LAMBDA_OPTIONS,
    event,
    lambdaPath,
    clientContext,
    callback: createSynchronousFunctionCallback(response),
    timeoutMs: timeout * SECONDS_TO_MILLISECONDS,
  })

const BACKGROUND_FUNCTION_STATUS_CODE = 202
const executeBackgroundFunction = ({ event, lambdaPath, timeout, clientContext, response, functionName }) => {
  console.log(`${NETLIFYDEVLOG} Queueing background function ${styleFunctionName(functionName)} for execution`)
  response.status(BACKGROUND_FUNCTION_STATUS_CODE)
  response.end()

  return lambdaLocal.execute({
    ...DEFAULT_LAMBDA_OPTIONS,
    event,
    lambdaPath,
    clientContext,
    callback: createBackgroundFunctionCallback(functionName),
    timeoutMs: timeout * SECONDS_TO_MILLISECONDS,
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

const logBeforeAction = ({ path, action }) => {
  console.log(`${NETLIFYDEVLOG} ${path} ${action}, reloading...`)
}

const logAfterAction = ({ path, action }) => {
  console.log(`${NETLIFYDEVLOG} ${path} ${action}, successfully reloaded!`)
}

const clearRequireCache = () => {
  Object.keys(require.cache).forEach((key) => {
    delete require.cache[key]
  })
}

const clearCache =
  ({ action }) =>
  (path) => {
    logBeforeAction({ path, action })
    clearRequireCache()
    logAfterAction({ path, action })
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

const DEBOUNCE_WAIT = 300

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

const setupDefaultFunctionHandler = async ({ capabilities, directory, warn }) => {
  const context = {
    functions: [],
    watchDirs: [],
  }
  const { functions, watchDirs } = await getFunctionsAndWatchDirs(directory)
  const watcher = chokidar.watch(watchDirs, { ignored: /node_modules/, ignoreInitial: true })
  const debouncedOnChange = debounce(clearCache({ action: 'modified' }), DEBOUNCE_WAIT, {
    leading: false,
    trailing: true,
  })
  const debouncedOnUnlink = debounce(
    (path) => {
      context.functions = context.functions.filter((func) => func.mainFile !== path)

      clearCache({ action: 'deleted' })
    },
    DEBOUNCE_WAIT,
    {
      leading: false,
      trailing: true,
    },
  )
  const debouncedOnAdd = debounce(
    async (path) => {
      logBeforeAction({ path, action: 'added' })

      if (context.watchDirs.length !== 0) {
        await watcher.unwatch(watchDirs)
      }

      const { functions: newFunctions, watchDirs: newWatchDirs } = await getFunctionsAndWatchDirs(directory)

      validateFunctions({ functions, capabilities, warn })

      clearRequireCache()

      await watcher.add(newWatchDirs)

      context.functions = newFunctions
      context.watchDirs = newWatchDirs

      logAfterAction({ path, action: 'added' })
    },
    DEBOUNCE_WAIT,
    { leading: false, trailing: true },
  )

  validateFunctions({ functions, capabilities, warn })

  context.functions = functions
  context.watchDirs = watchDirs

  watcher.on('change', debouncedOnChange).on('unlink', debouncedOnUnlink).on('add', debouncedOnAdd)

  const getFunctionByName = (functionName) => context.functions.find(({ name }) => name === functionName)

  return { getFunctionByName }
}

const createFormSubmissionHandler = function ({ siteUrl, warn }) {
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
        warn(error)
        return next()
      }
    } else {
      warn('Invalid Content-Type for Netlify Dev forms request')
      return next()
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

const getFunctionsServer = async function ({ getFunctionByName, siteUrl, warn, timeouts, prefix }) {
  const app = express()
  app.set('query parser', 'simple')

  app.use(
    bodyParser.text({
      limit: '6mb',
      type: ['text/*', 'application/json'],
    }),
  )
  app.use(bodyParser.raw({ limit: '6mb', type: '*/*' }))
  app.use(createFormSubmissionHandler({ siteUrl, warn }))
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

const getBuildFunction = ({ functionBuilder, log }) =>
  async function build(updatedPath, eventType) {
    const relativeFunctionsDir = relative(cwd(), functionBuilder.src)

    log(`${NETLIFYDEVLOG} ${chalk.magenta('Building')} functions from directory ${chalk.yellow(relativeFunctionsDir)}`)

    try {
      const functions = await functionBuilder.build(updatedPath, eventType)
      const functionNames = (functions || []).map((path) => relative(functionBuilder.src, path))

      // If the build command has returned a set of functions that have been
      // updated, the list them in the log message. If not, we show a generic
      // message with the functions directory.
      if (functionNames.length === 0) {
        log(
          `${NETLIFYDEVLOG} ${chalk.green('Finished')} building functions from directory ${chalk.yellow(
            relativeFunctionsDir,
          )}`,
        )
      } else {
        log(
          `${NETLIFYDEVLOG} ${chalk.green('Finished')} building functions: ${functionNames
            .map((name) => chalk.yellow(name))
            .join(', ')}`,
        )
      }
    } catch (error) {
      const errorMessage = (error.stderr && error.stderr.toString()) || error.message
      log(
        `${NETLIFYDEVLOG} ${chalk.red('Failed')} building functions from directory ${chalk.yellow(
          relativeFunctionsDir,
        )}${errorMessage ? ` with error:\n${errorMessage}` : ''}`,
      )
    }
  }

const setupFunctionsBuilder = async ({ config, errorExit, functionsDirectory, log, site }) => {
  const functionBuilder = await detectFunctionsBuilder({
    config,
    errorExit,
    functionsDirectory,
    log,
    projectRoot: site.root,
  })

  if (!functionBuilder) {
    return {}
  }

  const npmScriptString = functionBuilder.npmScript
    ? `: Running npm script ${chalk.yellow(functionBuilder.npmScript)}`
    : ''

  log(`${NETLIFYDEVLOG} Function builder ${chalk.yellow(functionBuilder.builderName)} detected${npmScriptString}.`)

  const buildFunction = getBuildFunction({ functionBuilder, log })

  await buildFunction()

  const functionWatcher = chokidar.watch(functionBuilder.src)
  functionWatcher.on('ready', () => {
    functionWatcher.on('add', (path) => buildFunction(path, 'add'))
    functionWatcher.on('change', async (path) => {
      await buildFunction(path, 'change')
      clearRequireCache()
    })
    functionWatcher.on('unlink', (path) => buildFunction(path, 'unlink'))
  })

  return functionBuilder
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

    await startServer({ server, settings, log, errorExit })
  }
}

module.exports = { startFunctionsServer }
