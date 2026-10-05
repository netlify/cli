import { lookup } from 'dns/promises'
import { stat } from 'fs/promises'
import http from 'http'
import type { AddressInfo } from 'net'
import path from 'path'

import express from 'express'

import { log, NETLIFYDEVLOG } from './command-helpers.js'
import type { ServerSettings } from './types.js'

const ALLOWED_METHODS = new Set(['GET', 'HEAD'])
const LOCALHOST = 'localhost'
const GENERATED_RESPONSE_CACHE_CONTROL = 'public, max-age=0, must-revalidate'
const FILE_CACHE_CONTROL = 'public, max-age=0'
const ENCODED_SLASH = /%2f/i

const FILE_OPTIONS = {
  acceptRanges: false,
  dotfiles: 'allow',
  etag: false,
  lastModified: false,
} as const

const listen = (server: http.Server, port: number | undefined, host: string) =>
  new Promise<AddressInfo>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      server.off('error', reject)
      resolve(server.address() as AddressInfo)
    })
  })

const getErrorStatus = (error: unknown) =>
  error instanceof Object && 'status' in error && typeof error.status === 'number' ? error.status : 500

const isDirectory = async (filePath: string) => {
  try {
    return (await stat(filePath)).isDirectory()
  } catch {
    return false
  }
}

const createApp = (rootPath: string) => {
  const app = express()
  app.disable('x-powered-by')
  app.disable('etag')

  const serveFile = express.static(rootPath, {
    ...FILE_OPTIONS,
    redirect: false,
    setHeaders: (res) => {
      res.setHeader('cache-control', FILE_CACHE_CONTROL)
    },
  })

  app.use(async (req, res, next) => {
    let decodedPath: string
    try {
      decodedPath = decodeURIComponent(req.path)
    } catch {
      res.status(400).type('text/plain').send('Bad Request')
      return
    }

    res.setHeader('age', '0')
    res.setHeader('cache-control', GENERATED_RESPONSE_CACHE_CONTROL)
    if (!ALLOWED_METHODS.has(req.method)) {
      res.status(405).type('text/plain').send('Method Not Allowed')
      return
    }
    if (decodedPath.includes('\0')) {
      res.status(400).type('text/plain').send('Bad Request')
      return
    }
    // Encoded slashes aren't decoded into path separators, so they never match a file.
    if (ENCODED_SLASH.test(req.path)) {
      next()
      return
    }

    // No validators are sent, so conditional requests always get the full file.
    delete req.headers['if-none-match']
    delete req.headers['if-modified-since']
    // Directories without a trailing slash serve their index.html directly instead of redirecting.
    if (!req.path.endsWith('/') && (await isDirectory(path.join(rootPath, decodedPath)))) {
      req.url = req.url.replace(req.path, `${req.path}/`)
    }
    serveFile(req, res, next)
  })

  app.use((_req, res) => {
    const headers = { 'cache-control': FILE_CACHE_CONTROL }
    res.status(404).sendFile('404.html', { ...FILE_OPTIONS, headers, root: rootPath }, (error: Error | undefined) => {
      if (error && !res.headersSent) {
        res.status(404).type('text/plain').send('404 Not Found')
      }
    })
  })

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = error instanceof URIError ? 400 : getErrorStatus(error)
    res.status(status).type('text/plain').send(http.STATUS_CODES[status])
  })

  return app
}

export const startStaticServer = async ({ settings }: { settings: Pick<ServerSettings, 'dist' | 'frameworkPort'> }) => {
  const app = createApp(path.resolve(settings.dist))

  const mainAddress = await listen(http.createServer(app), settings.frameworkPort, LOCALHOST)
  const additionalAddresses: AddressInfo[] = []
  const localhostAddresses = await lookup(LOCALHOST, { all: true }).catch(() => [])
  for (const { address } of localhostAddresses) {
    if (address !== mainAddress.address) {
      try {
        additionalAddresses.push(await listen(http.createServer(app), mainAddress.port, address))
      } catch {
        // Localhost addresses that can't be bound, e.g. with IPv6 disabled, are skipped.
      }
    }
  }

  log(`\n${NETLIFYDEVLOG} Static server listening to`, String(settings.frameworkPort))
  // The dev proxy connects using this family. Reporting the first additional binding keeps it on 127.0.0.1
  // when localhost resolves to ::1 first.
  const [reportedAddress] = [...additionalAddresses, mainAddress]
  return { family: reportedAddress.family }
}
