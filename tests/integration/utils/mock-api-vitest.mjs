import { isDeepStrictEqual } from 'util'

import express, { urlencoded, json, raw } from 'express'
import { afterAll, beforeAll, beforeEach } from 'vitest'

// Replace mock-api.cjs with this once everything migrated

const addRequest = (requests, request) => {
  requests.push({
    path: request.path,
    body: request.body,
    method: request.method,
    headers: request.headers,
  })
}

const clearRequests = (requests) => {
  // We cannot create a new array, as the reference of this array is used in tests
  requests.length = 0
}

const startMockApi = ({ routes, silent }) => {
  const requests = []
  const app = express()
  app.use(urlencoded({ extended: true }))
  app.use(json())
  app.use(raw())

  routes.forEach(({ method = 'get', path, requestBody, response = {}, status = 200 }) => {
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
    if (!silent) {
      console.warn(`Route not found: (${req.method.toUpperCase()}) ${req.url}`)
    }
    res.status(404)
    res.json({ message: 'Not found' })
  })

  return new Promise((resolve, reject) => {
    const server = app.listen()

    server.on('listening', () => {
      resolve({ server, requests, clearRequests: clearRequests.bind(null, requests) })
    })

    server.on('error', (error) => {
      reject(error)
    })
  })
}

export const withMockApi = async (routes, factory, silent = false) => {
  let mockApi
  beforeAll(async () => {
    mockApi = await startMockApi({ routes, silent })
  })

  beforeEach((context) => {
    context.apiUrl = `http://localhost:${mockApi.server.address().port}/api/v1`
    context.requests = mockApi.requests
    mockApi.clearRequests()
  })

  afterAll(() => {
    mockApi.server.close()
  })

  factory()
}

const getEnvironmentVariables = ({ apiUrl }) => ({
  NETLIFY_AUTH_TOKEN: 'fake-token',
  NETLIFY_SITE_ID: 'site_id',
  NETLIFY_API_URL: apiUrl,
})

export const getCLIOptions = ({ apiUrl, builder: { directory: cwd }, env = {}, extendEnv = true }) => ({
  cwd,
  env: { ...getEnvironmentVariables({ apiUrl }), ...env },
  extendEnv,
})
