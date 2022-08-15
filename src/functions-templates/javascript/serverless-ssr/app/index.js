/* Express App */
const process = require('process')

const compression = require('compression')
const cors = require('cors')
const express = require('express')
const morgan = require('morgan')

/* My express App */
module.exports = function expressApp(functionName) {
  const app = express()
  const router = express.Router()

  // gzip responses
  router.use(compression())

  // Set router base path for local dev
  const routerBasePath = process.env.NODE_ENV === 'dev' ? `/${functionName}` : `/.netlify/functions/${functionName}/`

  /* define routes */
  router.get('/', function onRequest(req, res) {
    const html = `
    <html>
      <head>
        <style>
          body {
            padding: 30px;
          }
        </style>
      </head>
      <body>
        <h1>Express via '${functionName}' ⊂◉‿◉つ</h1>

        <p>I'm using Express running via a <a href='https://docs.netlify.com/functions/overview/' target='_blank'>Netlify Function</a>.</p>

        <p>Choose a route:</p>

        <div>
          <a href='/.netlify/functions/${functionName}/users'>View /users route</a>
        </div>

        <div>
          <a href='/.netlify/functions/${functionName}/hello'>View /hello route</a>
        </div>

        <br/>
        <br/>

        <div>
          <a href='/'>
            Go back to demo homepage
          </a>
        </div>

        <br/>
        <br/>

        <div>
          <a href='https://github.com/DavidWells/netlify-functions-express' target='_blank'>
            See the source code on GitHub
          </a>
        </div>
      </body>
    </html>
  `
    res.send(html)
  })

  router.get('/users', function onRequest(req, res) {
    res.json({
      users: [
        {
          name: 'steve',
        },
        {
          name: 'joe',
        },
      ],
    })
  })

  router.get('/hello/', function onRequest(req, res) {
    res.send('hello world')
  })

  // Attach logger
  app.use(morgan(customLogger))

  // Setup routes
  app.use(routerBasePath, router)

  // Apply express middlewares
  router.use(cors())
  router.use(express.json())
  router.use(express.urlencoded({ extended: true }))

  return app
}

const customLogger = function (tokens, req, res) {
  const log = [
    tokens.method(req, res),
    tokens.url(req, res),
    tokens.status(req, res),
    tokens.res(req, res, 'content-length'),
    '-',
    tokens['response-time'](req, res),
    'ms',
  ].join(' ')

  if (process.env.NODE_ENV !== 'dev') {
    // Log only in AWS context to get back function logs
    console.log(log)
  }
  return log
}
