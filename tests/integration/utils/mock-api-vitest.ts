import type { Server } from 'http'
import type { AddressInfo } from 'net'
import { isDeepStrictEqual, promisify } from 'util'

import type { CommonOptions, NodeOptions } from 'execa'
import express, { urlencoded, json, raw } from 'express'
import { afterAll, beforeAll, beforeEach } from 'vitest'

export enum HTTPMethod {
  DELETE = 'DELETE',
  GET = 'GET',
  PATCH = 'PATCH',
  POST = 'POST',
  PUT = 'PUT',
}

export interface Route {
  method?: HTTPMethod | 'all'
  path: string
  response?: any
  requestBody?: any
  status?: number
}

interface MockApiOptions {
  routes: Route[]
  silent?: boolean
}

export interface MockApi {
  apiUrl: string
  clearRequests: () => void
  requests: any[]
  server: Server
  close: () => Promise<void>
}

export interface MockApiTestContext {
  apiUrl: string
  requests: any[]
}

// Replace mock-api.js with this once everything migrated

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

export const startMockApi = ({ routes, silent }: MockApiOptions): Promise<MockApi> => {
  console.log('routes', routes)
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

      if (typeof response === 'function') {
        response(req, res)

        return
      }

      if (status === 404) {
        response.message = 'Not found'
      }
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
      const address: AddressInfo = server.address() as AddressInfo

      resolve({
        server,
        apiUrl: `http://localhost:${address.port}/api/v1`,
        requests,
        clearRequests: clearRequests.bind(null, requests),
        async close() {
          return promisify(server.close.bind(server))()
        },
      })
    })

    server.on('error', (error) => {
      reject(error)
    })
  })
}

export const withMockApi = async (routes, factory, silent = false) => {
  let mockApi: MockApi
  beforeAll(async () => {
    mockApi = await startMockApi({ routes, silent })
  })

  beforeEach<MockApiTestContext>((context) => {
    context.apiUrl = mockApi.apiUrl
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

export const getCLIOptions = ({
  apiUrl,
  builder,
  cwd,
  env = {},
  extendEnv = true,
}: {
  apiUrl?: string
  builder?: any
  cwd?: string
  env?: CommonOptions<string>['env']
  extendEnv?: CommonOptions<string>['extendEnv']
}): NodeOptions<string> => ({
  cwd: builder?.directory || cwd,
  env: { ...getEnvironmentVariables({ apiUrl }), ...env },
  extendEnv,
})
