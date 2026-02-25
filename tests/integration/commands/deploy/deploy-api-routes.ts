import type { AddressInfo } from 'net'
import { isDeepStrictEqual, promisify } from 'util'

import expressModule, { urlencoded, json, raw } from 'express'

import type { Route, MockApi } from '../../utils/mock-api-vitest.js'
import type express from 'express'

const siteInfo = {
  id: 'site_id',
  name: 'test-site',
  account_slug: 'test-account',
  admin_url: 'https://app.netlify.com/projects/test-site',
  ssl_url: 'https://test-site.netlify.app',
  url: 'https://test-site.netlify.app',
  build_settings: { repo_url: '' },
}

const deployResponse = {
  id: 'deploy_id',
  site_id: 'site_id',
  name: 'test-site',
  deploy_ssl_url: 'https://deploy-id--test-site.netlify.app',
  deploy_url: 'https://deploy-id--test-site.netlify.app',
  admin_url: 'https://app.netlify.com/projects/test-site',
  ssl_url: 'https://test-site.netlify.app',
  url: 'https://test-site.netlify.app',
}

interface DeployBody {
  files?: Record<string, string>
  functions?: Record<string, string>
  function_schedules?: unknown[]
  functions_config?: Record<string, unknown>
  async?: boolean
  branch?: string
  draft?: boolean
}

export interface DeployRouteState {
  getDeployBody: () => DeployBody | null
  getUploadedFiles: () => Record<string, Buffer>
  getUploadedFunctions: () => Record<string, Buffer>
  reset: () => void
}

export const createDeployRoutes = (): { routes: Route[] } & DeployRouteState => {
  let lastDeployBody: DeployBody | null = null
  let uploadedFiles: Record<string, Buffer> = {}
  let uploadedFunctions: Record<string, Buffer> = {}

  const routes: Route[] = [
    // Site info
    { path: 'sites/site_id', response: siteInfo },
    { path: 'sites', method: 'GET', response: [siteInfo] },
    { path: 'accounts', response: [{ slug: 'test-account' }] },

    // Env vars (getEnvelopeEnv calls this)
    { path: 'accounts/test-account/env', response: [] },

    // List deploys (for latest deploy check)
    { path: 'sites/site_id/deploys', method: 'GET', response: [] },

    // Create deploy
    {
      path: 'sites/site_id/deploys',
      method: 'POST',
      response: (_req: express.Request, res: express.Response) => {
        res.json({
          ...deployResponse,
          state: 'prepared',
          required: [],
          required_functions: [],
          skew_protection_token: 'test-skew-token',
        })
      },
    },

    // Update deploy (CDN diff) — files/functions manifest is sent here
    {
      path: 'sites/site_id/deploys/deploy_id',
      method: 'PUT',
      response: (req: express.Request, res: express.Response) => {
        lastDeployBody = req.body as DeployBody
        const fileHashes = Object.values(lastDeployBody.files || {})
        const fnHashes = Object.values(lastDeployBody.functions || {})
        res.json({
          ...deployResponse,
          state: 'prepared',
          required: fileHashes,
          required_functions: fnHashes,
        })
      },
    },

    // Upload file (Express 5 wildcard syntax)
    {
      path: 'deploys/deploy_id/files/{*filepath}',
      method: 'PUT',
      response: (req: express.Request, res: express.Response) => {
        const filePath = Array.isArray(req.params.filepath)
          ? req.params.filepath.join('/')
          : req.params.filepath
        uploadedFiles[filePath] = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body as string)
        res.json({ message: 'ok' })
      },
    },

    // Upload function (Express 5 wildcard syntax)
    {
      path: 'deploys/deploy_id/functions/{*fnname}',
      method: 'PUT',
      response: (req: express.Request, res: express.Response) => {
        const fnName = Array.isArray(req.params.fnname) ? req.params.fnname.join('/') : req.params.fnname
        uploadedFunctions[fnName] = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body as string)
        res.json({ message: 'ok' })
      },
    },

    // Get deploy (polling) — return ready immediately
    {
      path: 'sites/site_id/deploys/deploy_id',
      method: 'GET',
      response: {
        ...deployResponse,
        state: 'ready',
      },
    },

    // Lock deploy (for --prod)
    { path: 'deploys/deploy_id/lock', method: 'POST', response: {} },

    // Unlock deploy
    { path: 'deploys/deploy_id/unlock', method: 'POST', response: {} },

    // Cancel deploy
    { path: 'deploys/deploy_id/cancel', method: 'POST', response: {} },

    // Get deploy by deploy_id (for `api getDeploy`)
    {
      path: 'deploys/deploy_id',
      method: 'GET',
      response: {
        ...deployResponse,
        state: 'ready',
        summary: {
          messages: [],
        },
      },
    },

    // Create build (for --trigger)
    {
      path: 'sites/site_id/builds',
      method: 'POST',
      response: { id: 'build_id', deploy_id: 'deploy_id' },
    },
  ]

  return {
    routes,
    getDeployBody: () => lastDeployBody,
    getUploadedFiles: () => uploadedFiles,
    getUploadedFunctions: () => uploadedFunctions,
    reset: () => {
      lastDeployBody = null
      uploadedFiles = {}
      uploadedFunctions = {}
    },
  }
}

export const startDeployMockApi = ({ routes }: { routes: Route[] }): Promise<MockApi> => {
  const requests: MockApi['requests'] = []
  const app = expressModule()
  app.use(urlencoded({ extended: true }))
  app.use(json())
  app.use(raw({ limit: '10mb' }))

  // Extensions/integrations routes (outside /api/v1/)
  app.get('/site/:siteId/integrations/safe', (_req, res) => {
    res.json([])
  })
  app.get('/team/:accountId/integrations/installations/meta/:siteId', (_req, res) => {
    res.json([])
  })

  routes.forEach(({ method = 'get', path, requestBody, response = {}, status = 200 }) => {
    app[method.toLowerCase() as 'all' | 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head'](
      `/api/v1/${path}`,
      function onRequest(req: express.Request, res: express.Response) {
        if (requestBody !== undefined) {
          if (!isDeepStrictEqual(requestBody, req.body)) {
            res.status(500)
            res.json({ message: `Request body doesn't match` })
            return
          }
        }
        requests.push({
          path: req.path,
          body: req.body,
          method: req.method,
          headers: req.headers,
        })
        res.status(status)

        if (typeof response === 'function') {
          response(req, res)
          return
        }

        res.json(response)
      },
    )
  })

  app.all('{*splat}', function onRequest(req, res) {
    requests.push({
      path: req.path,
      body: req.body,
      method: req.method,
      headers: req.headers,
    })
    res.status(404)
    res.json({ message: 'Not found' })
  })

  return new Promise((resolve, reject) => {
    const server = app.listen()

    server.on('listening', () => {
      const address = server.address() as AddressInfo

      resolve({
        server,
        apiUrl: `http://localhost:${address.port.toString()}/api/v1`,
        requests,
        clearRequests: () => {
          requests.length = 0
        },
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
