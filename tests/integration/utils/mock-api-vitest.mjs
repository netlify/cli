import { isDeepStrictEqual } from 'util'

import fastifyUrlData from '@fastify/url-data'
import fastify from 'fastify'
import { afterAll, beforeAll, beforeEach } from 'vitest'

// Replace mock-api.cjs with this once everything migrated

const addRequest = (requests, request) => {
  requests.push({
    path: request.urlData().path,
    body: request.body,
    method: request.method,
    headers: request.headers,
  })
}

const clearRequests = (requests) => {
  // We cannot create a new array, as the reference of this array is used in tests
  requests.length = 0
}

const startMockApi = async ({ routes, silent }) => {
  const requests = []
  const app = fastify()
  app.register(fastifyUrlData)

  routes.forEach(({ method = 'get', path, requestBody, response = {}, status = 200 }) => {
    app.route({
      method: method.toUpperCase(),
      url: `/api/v1/${path}`,
      handler(request, reply) {
        if (requestBody !== undefined && !isDeepStrictEqual(requestBody, request.body)) {
          reply.statusCode = 500
          reply.send({ message: `Request body doesn't match` })
          return
        }
        addRequest(requests, request)
        reply.statusCode = status
        reply.send(response)
      },
    })
  })

  app.all('*', function onRequest(request, reply) {
    addRequest(requests, request)
    if (!silent) {
      console.warn(`Route not found: (${request.method.toUpperCase()}) ${request.url}`)
    }
    reply.statusCode = 404
    reply.send({ message: 'Not found' })
  })

  await app.listen()

  return {
    app,
    requests,
    clearRequests: clearRequests.bind(null, requests),
  }
}

export const withMockApi = async (routes, factory, silent = false) => {
  let mockApi
  beforeAll(async () => {
    mockApi = await startMockApi({ routes, silent })
  })

  beforeEach((context) => {
    context.apiUrl = `http://localhost:${mockApi.app.server.address().port}/api/v1`
    context.requests = mockApi.requests
    mockApi.clearRequests()
  })

  afterAll(async () => {
    if (mockApi) await mockApi.app.close()
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
