import type { IncomingHttpHeaders, Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import process from 'process'
import { isDeepStrictEqual, promisify } from 'util'

import type { CommonOptions, NodeOptions } from 'execa'
import express from 'express'

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
}

export interface MockApi {
  apiUrl: string
  requests: { path: string; body: unknown; method: string; headers: IncomingHttpHeaders }[]
  server: Server
  close: () => Promise<void>
}

export interface MockApiTestContext {
  apiUrl: string
  requests: MockApi['requests']
}

const addRequest = (requests: MockApi['requests'], request: express.Request) => {
  requests.push({
    path: request.path,
    body: request.body,
    method: request.method,
    headers: request.headers,
  })
}

/**
 *
 * @param {*} param0
 * @returns
 */
export const startMockApi = ({ routes, silent }: MockApiOptions): Promise<MockApi> => {
  const requests: MockApi['requests'] = []
  const app = express()
  app.use(express.urlencoded({ extended: true }))
  app.use(express.json())
  app.use(express.raw())

  routes.forEach(({ method = 'get', path, requestBody, response = {}, status = 200 }) => {
    app[method.toLowerCase() as 'all' | 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head'](
      `/api/v1/${path}`,
      function onRequest(req, res) {
        if (process.env.DEBUG_TESTS) {
          console.debug('[mock-api] ', req.method, req.path, req.body)
        }
        // validate request body
        if (requestBody !== undefined && !isDeepStrictEqual(requestBody, req.body)) {
          res.status(500)
          res.json({ message: `Request body doesn't match` })
          return
        }
        addRequest(requests, req)
        res.status(status)
        res.json(response)
      },
    )
  })

  app.get('/site/site_id/integrations/safe', function onRequest(req, res) {
    if (process.env.DEBUG_TESTS) {
      console.debug('[mock-api] ', req.method, req.path, req.body)
    }
    addRequest(requests, req)
    res.status(200)
    res.json([])
  })

  app.get('/team/account_id/integrations/installations/meta/site_id', function onRequest(req, res) {
    if (process.env.DEBUG_TESTS) {
      console.debug('[mock-api] ', req.method, req.path, req.body)
    }
    addRequest(requests, req)
    res.status(200)
    res.json([])
  })

  app.all('*', function onRequest(req, res) {
    if (process.env.DEBUG_TESTS) {
      console.debug('[mock-api] ', req.method, req.path, req.body)
    }
    addRequest(requests, req)
    if (!silent) {
      console.warn(`Route not found: (${req.method.toUpperCase()}) ${req.url}`)
    }
    res.status(404)
    res.json({ message: 'Not found' })
  })

  const returnPromise = new Promise<MockApi>((resolve, reject) => {
    const server = app.listen()

    server.on('listening', () => {
      const address: AddressInfo = server.address() as AddressInfo
      resolve({
        server,
        apiUrl: `http://localhost:${address.port.toString()}/api/v1`,
        requests,
        async close() {
          return promisify(server.close.bind(server))()
        },
      })
    })

    server.on('error', (error) => {
      reject(error)
    })
  })

  return returnPromise
}

export const withMockApi = async (
  routes: Route[],
  testHandler: (options: {
    apiUrl: string
    requests: { path: string; body: unknown; method: string; headers: IncomingHttpHeaders }[]
  }) => Promise<void>,
  silent = false,
) => {
  let mockApi: Awaited<ReturnType<typeof startMockApi>> | undefined
  try {
    mockApi = await startMockApi({ routes, silent })
    await testHandler({ apiUrl: mockApi.apiUrl, requests: mockApi.requests })
  } finally {
    mockApi?.server.close()
  }
}

// `CI` set to "true" to mock commands run from terminal command line
// `SHLVL` used to overwrite prompts for scripted commands in production/dev
// environments see `scriptedCommand` property of `BaseCommand`
export const getEnvironmentVariables = ({ apiUrl }: { apiUrl?: string }) => ({
  NETLIFY_AUTH_TOKEN: 'fake-token',
  NETLIFY_SITE_ID: 'site_id',
  NETLIFY_API_URL: apiUrl,
})

/**
 * Set the `isTTY` property of `process.stdin` to the given boolean value.
 * This function is used to establish flexible testing environments.
 * Falsey value is for noninteractive shell (-force flags overide user prompts)
 * Truthy value is for interactive shell
 */
export const setTTYMode = (bool: boolean) => {
  process.stdin.isTTY = bool
}

/**
 * Sets the `TESTING_PROMPTS` environment variable to the specified value.
 * This is used to make sure prompts are shown in the needed test sin ci/cd enviroments
 * If this is set to 'true', then prompts will be shown in for destructive commands even in non-interactive shells
 * or CI/CD enviroment
 *
 * @param {string} value - The value to set for the `TESTING_PROMPTS` environment variable.
 */
export const setTestingPrompts = (value: string) => {
  process.env.TESTING_PROMPTS = value
}

/**
 * Simulates a Continuous Integration environment by toggling the `CI`
 * environment variable. Truthy value is
 */
export const setCI = (value: string) => {
  process.env.CI = value
}

/**
 *
 * @param {*} param0
 * @returns {import('execa').Options<string>}
 */
export const getCLIOptions = ({
  apiUrl,
  builder,
  env = {},
  extendEnv = true,
}: {
  apiUrl?: string
  builder?: { directory?: string } | undefined
  cwd?: string
  env?: CommonOptions<string>['env']
  extendEnv?: CommonOptions<string>['extendEnv']
}): NodeOptions => ({
  cwd: builder?.directory,
  env: { ...getEnvironmentVariables({ apiUrl }), ...env },
  extendEnv,
})
