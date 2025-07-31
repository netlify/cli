import type { IncomingHttpHeaders, Server } from 'http'
import type { AddressInfo } from 'net'
import { isDeepStrictEqual, promisify } from 'util'

import type { CommonOptions, NodeOptions } from 'execa'
import express, { urlencoded, json, raw } from 'express'
import { afterAll, beforeAll, beforeEach } from 'vitest'

export interface Route {
  method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT' | 'HEAD' | 'OPTIONS' | 'all'
  path: string
  response?: ((req: express.Request, res: express.Response) => void) | Record<string, unknown> | unknown[]
  requestBody?: any
  status?: number
}

interface MockApiOptions {
  routes: Route[]
  silent?: boolean
  failOnMissingRoutes?: boolean
}

export interface MockApi {
  apiUrl: string
  clearRequests: () => void
  requests: { path: string; body: unknown; method: string; headers: IncomingHttpHeaders }[]
  server: Server
  close: () => Promise<void>
}

export interface MockApiTestContext {
  apiUrl: string
  requests: MockApi['requests']
}

// Replace mock-api.js with this once everything migrated

const addRequest = (requests: MockApi['requests'], request: express.Request) => {
  requests.push({
    path: request.path,
    body: request.body,
    method: request.method,
    headers: request.headers,
  })
}

const clearRequests = (requests: unknown[]) => {
  // We cannot create a new array, as the reference of this array is used in tests
  requests.length = 0
}

export const startMockApi = ({ routes, silent = false, failOnMissingRoutes = true }: MockApiOptions): Promise<MockApi> => {
  const requests: MockApi['requests'] = []
  const app = express()
  app.use(urlencoded({ extended: true }))
  app.use(json())
  app.use(raw())

  routes.forEach(({ method = 'get', path, requestBody, response = {}, status = 200 }) => {
    app[method.toLowerCase() as 'all' | 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head'](
      `/api/v1/${path}`,
      function onRequest(req: express.Request, res: express.Response) {
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
          if (typeof response === 'object' && !Array.isArray(response)) {
            response.message = 'Not found'
          }
        }
        res.json(response)
      },
    )
  })

  app.all('*', function onRequest(req, res) {
    addRequest(requests, req)
    
    const errorMessage = `Unmocked API route accessed: ${req.method.toUpperCase()} ${req.url}`
    
    if (failOnMissingRoutes) {
      // Fail the test by throwing an error instead of allowing the request to pass through
      console.error(`❌ TEST FAILURE: ${errorMessage}`)
      console.error('Add this route to your test\'s mock API routes to fix this error.')
      res.status(500)
      res.json({ 
        error: 'Test Failed - Unmocked Route', 
        message: errorMessage,
        hint: 'Add this route to your test\'s mock API routes to fix this error.'
      })
    } else {
      if (!silent) {
        console.warn(`Route not found: (${req.method.toUpperCase()}) ${req.url}`)
      }
      res.status(404)
      res.json({ message: 'Not found' })
    }
  })

  return new Promise((resolve, reject) => {
    const server = app.listen()

    server.on('listening', () => {
      const address: AddressInfo = server.address() as AddressInfo

      resolve({
        server,
        apiUrl: `http://localhost:${address.port.toString()}/api/v1`,
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

export const withMockApi = async (
  routes: Route[], 
  factory: () => void, 
  options: { silent?: boolean; failOnMissingRoutes?: boolean } | boolean = {}
) => {
  // Handle backward compatibility: if options is boolean, treat it as silent
  const { silent = false, failOnMissingRoutes = true } = typeof options === 'boolean' 
    ? { silent: options, failOnMissingRoutes: true }
    : options
  let mockApi: MockApi
  beforeAll(async () => {
    mockApi = await startMockApi({ routes, silent, failOnMissingRoutes })
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

  return Promise.resolve(undefined)
}

const getEnvironmentVariables = ({ apiUrl }: { apiUrl?: string }) => ({
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
  builder?: { directory?: string } | undefined
  cwd?: string
  env?: CommonOptions<string>['env']
  extendEnv?: CommonOptions<string>['extendEnv']
}): NodeOptions => ({
  cwd: builder?.directory || cwd,
  env: { ...getEnvironmentVariables({ apiUrl }), ...env },
  extendEnv,
})
