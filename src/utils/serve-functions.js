const express = require('express')
const bodyParser = require('body-parser')
const expressLogging = require('express-logging')
const queryString = require('querystring')
const getPort = require('get-port')
const chokidar = require('chokidar')
const jwtDecode = require('jwt-decode')
const {
  NETLIFYDEVLOG,
  // NETLIFYDEVWARN,
  NETLIFYDEVERR
} = require('netlify-cli-logo')
const { getFunctions } = require('./get-functions')

const defaultPort = 34567

function handleErr(err, response) {
  response.statusCode = 500
  response.write(`${NETLIFYDEVERR} Function invocation failed: ` + err.toString())
  response.end()
  console.log(`${NETLIFYDEVERR} Error during invocation: `, err) // eslint-disable-line no-console
}

// function getHandlerPath(functionPath) {
//   if (functionPath.match(/\.js$/)) {
//     return functionPath;
//   }
//   return path.join(functionPath, `${path.basename(functionPath)}.js`);
// }

function buildClientContext(headers) {
  // inject a client context based on auth header, ported over from netlify-lambda (https://github.com/netlify/netlify-lambda/pull/57)
  if (!headers.authorization) return

  const parts = headers.authorization.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return

  try {
    return {
      identity: {
        url: 'https://netlify-dev-locally-emulated-identity.netlify.com/.netlify/identity',
        token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzb3VyY2UiOiJuZXRsaWZ5IGRldiIsInRlc3REYXRhIjoiTkVUTElGWV9ERVZfTE9DQUxMWV9FTVVMQVRFRF9JREVOVElUWSJ9.2eSDqUOZAOBsx39FHFePjYj12k0LrxldvGnlvDu3GMI'
        // you can decode this with https://jwt.io/
        // just says
        // {
        //   "source": "netlify dev",
        //   "testData": "NETLIFY_DEV_LOCALLY_EMULATED_IDENTITY"
        // }
      },
      user: jwtDecode(parts[1])
    }
  } catch (_) {
    // Ignore errors - bearer token is not a JWT, probably not intended for us
  }
}

function createHandler(dir) {
  const functions = getFunctions(dir)

  const clearCache = action => path => {
    console.log(`${NETLIFYDEVLOG} ${path} ${action}, reloading...`) // eslint-disable-line no-console
    Object.keys(require.cache).forEach(k => {
      delete require.cache[k]
    })
  }
  const watcher = chokidar.watch(dir, { ignored: /node_modules/ })
  watcher.on('change', clearCache('modified')).on('unlink', clearCache('deleted'))

  return function(request, response) {
    // handle proxies without path re-writes (http-servr)
    const cleanPath = request.path.replace(/^\/.netlify\/functions/, '')

    const func = cleanPath.split('/').filter(function(e) {
      return e
    })[0]
    if (!functions[func]) {
      response.statusCode = 404
      response.end('Function not found...')
      return
    }
    const { functionPath, moduleDir } = functions[func]
    let handler
    let before = module.paths
    try {
      module.paths = [moduleDir]
      handler = require(functionPath)
      if (typeof handler.handler !== 'function') {
        throw new Error(`function ${functionPath} must export a function named handler`)
      }
      module.paths = before
    } catch (error) {
      module.paths = before
      handleErr(error, response)
      return
    }

    const body = request.body.toString()
    var isBase64Encoded = Buffer.from(body, 'base64').toString('base64') === body

    let remoteAddress =
      request.headers['x-forwarded-for'] || request.headers['X-Forwarded-for'] || request.connection.remoteAddress || ''
    remoteAddress = remoteAddress
      .split(remoteAddress.includes('.') ? ':' : ',')
      .pop()
      .trim()

    const lambdaRequest = {
      path: request.path,
      httpMethod: request.method,
      queryStringParameters: queryString.parse(request.url.split(/\?(.+)/)[1]),
      headers: Object.assign({}, request.headers, { 'client-ip': remoteAddress }),
      body: body,
      isBase64Encoded: isBase64Encoded
    }

    let callbackWasCalled = false
    const callback = createCallback(response)
    // we already checked that it exports a function named handler above
    const promise = handler.handler(
      lambdaRequest,
      { clientContext: buildClientContext(request.headers) || {} },
      callback
    )
    /** guard against using BOTH async and callback */
    if (callbackWasCalled && promise && typeof promise.then === 'function') {
      throw new Error(
        'Error: your function seems to be using both a callback and returning a promise (aka async function). This is invalid, pick one. (Hint: async!)'
      )
    } else {
      // it is definitely an async function with no callback called, good.
      promiseCallback(promise, callback)
    }

    /** need to keep createCallback in scope so we can know if cb was called AND handler is async */
    function createCallback(response) {
      return function(err, lambdaResponse) {
        callbackWasCalled = true
        if (err) {
          return handleErr(err, response)
        }
        if (lambdaResponse === undefined) {
          return handleErr('lambda response was undefined. check your function code again.', response)
        }
        if (!Number(lambdaResponse.statusCode)) {
          console.log(
            `${NETLIFYDEVERR} Your function response must have a numerical statusCode. You gave: $`,
            lambdaResponse.statusCode
          )
          return handleErr('Incorrect function response statusCode', response)
        }
        if (typeof lambdaResponse.body !== 'string') {
          console.log(`${NETLIFYDEVERR} Your function response must have a string body. You gave:`, lambdaResponse.body)
          return handleErr('Incorrect function response body', response)
        }

        response.statusCode = lambdaResponse.statusCode
        // eslint-disable-line guard-for-in
        for (const key in lambdaResponse.headers) {
          response.setHeader(key, lambdaResponse.headers[key])
        }
        for (const key in lambdaResponse.multiValueHeaders) {
          const items = lambdaResponse.multiValueHeaders[key]
          response.setHeader(key, items)
        }
        response.write(
          lambdaResponse.isBase64Encoded ? Buffer.from(lambdaResponse.body, 'base64') : lambdaResponse.body
        )
        response.end()
      }
    }
  }
}

function promiseCallback(promise, callback) {
  if (!promise) return // means no handler was written
  if (typeof promise.then !== 'function') return
  if (typeof callback !== 'function') return

  promise.then(
    function(data) {
      callback(null, data)
    },
    function(err) {
      callback(err, null)
    }
  )
}

async function serveFunctions(settings) {
  const app = express()
  const dir = settings.functionsDir
  const port = await getPort({
    port: assignLoudly(settings.port, defaultPort)
  })

  app.use(
    bodyParser.text({
      limit: '6mb',
      type: ['text/*', 'application/json', 'multipart/form-data']
    })
  )
  app.use(bodyParser.raw({ limit: '6mb', type: '*/*' }))
  app.use(
    expressLogging(console, {
      blacklist: ['/favicon.ico']
    })
  )

  app.get('/favicon.ico', function(req, res) {
    res.status(204).end()
  })
  app.all('*', createHandler(dir))

  app.listen(port, function(err) {
    if (err) {
      console.error(`${NETLIFYDEVERR} Unable to start lambda server: `, err) // eslint-disable-line no-console
      process.exit(1)
    }

    // add newline because this often appears alongside the client devserver's output
    console.log(`\n${NETLIFYDEVLOG} Lambda server is listening on ${port}`) // eslint-disable-line no-console
  })

  return Promise.resolve({
    port
  })
}

module.exports = { serveFunctions }

// if first arg is undefined, use default, but tell user about it in case it is unintentional
function assignLoudly(
  optionalValue,
  fallbackValue,
  tellUser = dV => console.log(`${NETLIFYDEVLOG} No port specified, using defaultPort of `, dV) // eslint-disable-line no-console
) {
  if (fallbackValue === undefined) throw new Error('must have a fallbackValue')
  if (fallbackValue !== optionalValue && optionalValue === undefined) {
    tellUser(fallbackValue)
    return fallbackValue
  }
  return optionalValue
}
