import type { Server } from 'http'
import type { AddressInfo } from 'net'
import { isDeepStrictEqual, promisify } from 'util'

import type { CommonOptions, NodeOptions } from 'execa'
import express, { urlencoded, json, raw } from 'express'
import { afterAll, beforeAll, beforeEach } from 'vitest'
import {http, HttpResponse} from 'msw'


export enum HTTPMethod {
  DELETE = 'DELETE',
  GET = 'GET',
  PATCH = 'PATCH',
  POST = 'POST',
  PUT = 'PUT',
}

export interface Route {
  method?: HTTPMethod
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

// Replace mock-api.mjs with this once everything migrated

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
  const requests = []
  const app = express()
  app.use(urlencoded({ extended: true }))
  app.use(json())
  app.use(raw())

  app.all('*', async function onRequest(req, res) {
    const test = {}
    Object.entries(req.headers).map(([key, value]) => {test[key] = value})
    const headers: HeadersInit = new Headers(test);

    await fetch(`http://localhost${req.url}`, {
      method: req.method,
      headers,
      body: JSON.stringify(req.body),
    }).then((response) => {
      res.status(response.status)
      res.json(response)
    }).catch((err) => {
      res.status(500)
      res.json({ message: err })
    })
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
