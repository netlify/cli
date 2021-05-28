const { isDeepStrictEqual } = require('util')

const bodyParser = require('body-parser')
const express = require('express')

const addRequest = (requests, request) => {
  requests.push({
    path: request.path,
    body: request.body,
    method: request.method,
    headers: request.headers,
  })
}

const startMockApi = ({ routes }) => {
  const requests = []
  const app = express()
  app.use(bodyParser.urlencoded({ extended: true }))
  app.use(bodyParser.json())
  app.use(bodyParser.raw())

  routes.forEach(({ method = 'get', path, response = {}, status = 200, requestBody }) => {
    app[method.toLowerCase()](`/api/v1/${path}`, function onRequest(req, res) {
      // validate request body
      if (requestBody !== undefined && !isDeepStrictEqual(requestBody, req.body)) {
        res.status(500)
        res.json({ message: `Request body doesn't match` })
        return
      }
      addRequest(requests, req)
      res.status(status)
      res.json(response)
    })
  })

  app.all('*', function onRequest(req, res) {
    addRequest(requests, req)
    console.warn(`Route not found: (${req.method.toUpperCase()}) ${req.url}`)
    res.status(404)
    res.json({ message: 'Not found' })
  })

  return { server: app.listen(), requests }
}

const withMockApi = async (routes, testHandler) => {
  let mockApi
  try {
    mockApi = startMockApi({ routes })
    const apiUrl = `http://localhost:${mockApi.server.address().port}/api/v1`
    return await testHandler({ apiUrl, requests: mockApi.requests })
  } finally {
    mockApi.server.close()
  }
}

const getCLIOptions = ({ builder: { directory: cwd }, apiUrl }) => ({
  cwd,
  env: { NETLIFY_AUTH_TOKEN: 'fake-token', NETLIFY_SITE_ID: 'site_id', NETLIFY_API_URL: apiUrl },
})

module.exports = { withMockApi, startMockApi, getCLIOptions }
