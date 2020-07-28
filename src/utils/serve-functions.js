const { URL } = require('url')
const express = require('express')
const bodyParser = require('body-parser')
const expressLogging = require('express-logging')
const chokidar = require('chokidar')
const jwtDecode = require('jwt-decode')
const lambdaLocal = require('lambda-local')
const winston = require('winston')
const querystring = require('querystring')
const contentType = require('content-type')
const getRawBody = require('raw-body')
const multiparty = require('multiparty')
const { Readable } = require('stream')
const {
  NETLIFYDEVLOG,
  // NETLIFYDEVWARN,
  NETLIFYDEVERR,
} = require('./logo')
const { getFunctions } = require('./get-functions')

function handleErr(err, response) {
  response.statusCode = 500
  response.write(`${NETLIFYDEVERR} Function invocation failed: ` + err.toString())
  response.end()
  console.log(`${NETLIFYDEVERR} Error during invocation: `, err)
}

function capitalize(t) {
  return t.replace(/(^\w|\s\w)/g, m => m.toUpperCase())
}

// function getHandlerPath(functionPath) {
//   if (functionPath.match(/\.js$/)) {
//     return functionPath;
//   }
//   return path.join(functionPath, `${path.basename(functionPath)}.js`);
// }

/** need to keep createCallback in scope so we can know if cb was called AND handler is async */
function createCallback(response) {
  return function(err, lambdaResponse) {
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
    if (lambdaResponse.body && typeof lambdaResponse.body !== 'string') {
      console.log(`${NETLIFYDEVERR} Your function response must have a string body. You gave:`, lambdaResponse.body)
      return handleErr('Incorrect function response body', response)
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

function createHandler(dir) {
  const functions = getFunctions(dir)

  const clearCache = action => path => {
    console.log(`${NETLIFYDEVLOG} ${path} ${action}, reloading...`)
    Object.keys(require.cache).forEach(k => {
      delete require.cache[k]
    })
    console.log(`${NETLIFYDEVLOG} ${path} ${action}, successfully reloaded!`)
  }
  const watcher = chokidar.watch(dir, { ignored: /node_modules/ })
  watcher.on('change', clearCache('modified')).on('unlink', clearCache('deleted'))

  const logger = winston.createLogger({
    levels: winston.config.npm.levels,
    transports: [new winston.transports.Console({ level: 'warn' })],
  })
  lambdaLocal.setLogger(logger)

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
    const { functionPath } = functions[func]

    const isBase64Encoded = !!(request.headers['content-type'] || '')
      .toLowerCase()
      .match(/image|audio|video|application\/pdf|application\/zip|applicaton\/octet-stream/)

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
      (prev, [k, v]) => ({ ...prev, [k]: Array.isArray(v) ? v : [v] }),
      {}
    )
    const headers = Object.entries({ ...request.headers, 'client-ip': [remoteAddress] }).reduce(
      (prev, [k, v]) => ({ ...prev, [k]: Array.isArray(v) ? v : [v] }),
      {}
    )

    const event = {
      path: requestPath,
      httpMethod: request.method,
      queryStringParameters: Object.entries(queryParams).reduce((prev, [k, v]) => ({ ...prev, [k]: v.join(', ') }), {}),
      multiValueQueryStringParameters: queryParams,
      headers: Object.entries(headers).reduce((prev, [k, v]) => ({ ...prev, [k]: v.join(', ') }), {}),
      multiValueHeaders: headers,
      body,
      isBase64Encoded,
    }

    const callback = createCallback(response)

    return lambdaLocal.execute({
      event,
      lambdaPath: functionPath,
      clientContext: JSON.stringify(buildClientContext(request.headers) || {}),
      callback,
      verboseLevel: 3,
      timeoutMs: 10 * 1000,
    })
  }
}

function createFormSubmissionHandler(siteInfo) {
  return async function(req, res, next) {
    if (req.url.startsWith('/.netlify/') || req.method !== 'POST') return next()

    const fakeRequest = new Readable({
      read(size) {
        this.push(req.body)
        this.push(null)
      },
    })
    fakeRequest.headers = req.headers

    const originalUrl = new URL(req.url, 'http://localhost')
    req.url = '/.netlify/functions/submission-created' + originalUrl.search

    const ct = contentType.parse(req)
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
                [name]: values.map(v => ({
                  filename: v['originalFilename'],
                  size: v['size'],
                  type: v['headers'] && v['headers']['content-type'],
                  url: v['path'],
                })),
              }),
              {}
            )
            return resolve([
              Object.entries(Fields).reduce(
                (prev, [name, values]) => ({ ...prev, [name]: values.length > 1 ? values : values[0] }),
                {}
              ),
              Object.entries(Files).reduce(
                (prev, [name, values]) => ({ ...prev, [name]: values.length > 1 ? values : values[0] }),
                {}
              ),
            ])
          })
        })
      } catch (err) {
        return console.error(err)
      }
    } else {
      return console.error('Invalid Content-Type for Netlify Dev forms request')
    }
    const data = JSON.stringify({
      payload: {
        company:
          fields[Object.keys(fields).find(name => ['company', 'business', 'employer'].includes(name.toLowerCase()))],
        last_name:
          fields[Object.keys(fields).find(name => ['lastname', 'surname', 'byname'].includes(name.toLowerCase()))],
        first_name:
          fields[Object.keys(fields).find(name => ['firstname', 'givenname', 'forename'].includes(name.toLowerCase()))],
        name: fields[Object.keys(fields).find(name => ['name', 'fullname'].includes(name.toLowerCase()))],
        email:
          fields[
            Object.keys(fields).find(name =>
              ['email', 'mail', 'from', 'twitter', 'sender'].includes(name.toLowerCase())
            )
          ],
        title: fields[Object.keys(fields).find(name => ['title', 'subject'].includes(name.toLowerCase()))],
        data: {
          ...fields,
          ...files,
          ip: req.connection.remoteAddress,
          user_agent: req.headers['user-agent'],
          referrer: req.headers['referer'],
        },
        created_at: new Date().toISOString(),
        human_fields: Object.entries({
          ...fields,
          ...Object.entries(files).reduce((prev, [name, data]) => ({ ...prev, [name]: data['url'] }), {}),
        }).reduce((prev, [key, val]) => ({ ...prev, [capitalize(key)]: val }), {}),
        ordered_human_fields: Object.entries({
          ...fields,
          ...Object.entries(files).reduce((prev, [name, data]) => ({ ...prev, [name]: data['url'] }), {}),
        }).map(([key, val]) => ({ title: capitalize(key), name: key, value: val })),
        site_url: siteInfo['ssl_url'],
      },
      site: siteInfo,
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

async function serveFunctions(dir, siteInfo = {}) {
  const app = express()
  app.set('query parser', 'simple')

  app.use(
    bodyParser.text({
      limit: '6mb',
      type: ['text/*', 'application/json'],
    })
  )
  app.use(bodyParser.raw({ limit: '6mb', type: '*/*' }))
  app.use(createFormSubmissionHandler(siteInfo))
  app.use(
    expressLogging(console, {
      blacklist: ['/favicon.ico'],
    })
  )

  app.get('/favicon.ico', function(req, res) {
    res.status(204).end()
  })

  app.all('*', createHandler(dir))

  return app
}

module.exports = { serveFunctions }
