import process from 'process'
import { isDeepStrictEqual, promisify } from 'util'

import express from 'express'

const addRequest = (requests, request) => {
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
export const startMockApi = ({ routes, silent }) => {
  const requests = []
  const app = express()
  app.use(express.urlencoded({ extended: true }))
  app.use(express.json())
  app.use(express.raw())

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

  const returnPromise = new Promise((resolve, reject) => {
    const server = app.listen()

    server.on('listening', () => {
      resolve({
        server,
        apiUrl: `http://localhost:${server.address().port}/api/v1`,
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

export const withMockApi = async (routes, testHandler, silent = false) => {
  let mockApi
  try {
    mockApi = await startMockApi({ routes, silent })
    return await testHandler({ apiUrl: mockApi.apiUrl, requests: mockApi.requests })
  } finally {
    mockApi.server.close()
  }
}

// `CI` set to "true" to mock commands run from terminal command line
// `SHLVL` used to overwrite prompts for scripted commands in production/dev
// environments see `scriptedCommand` property of `BaseCommand`
export const getEnvironmentVariables = ({ apiUrl }) => ({
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
export const setTTYMode = (bool) => {
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
export const setTestingPrompts = (value) => {
  process.env.TESTING_PROMPTS = value
}

/**
 * Simulates a Continuous Integration environment by toggling the `CI`
 * environment variable. Truthy value is
 */
export const setCI = (value) => {
  process.env.CI = value
}

/**
 *
 * @param {*} param0
 * @returns {import('execa').Options<string>}
 */
export const getCLIOptions = ({ apiUrl, builder, env = {}, extendEnv = true }) => ({
  cwd: builder?.directory,
  env: { ...getEnvironmentVariables({ apiUrl }), ...env },
  extendEnv,
})
