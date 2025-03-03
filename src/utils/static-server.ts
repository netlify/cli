import { createServer } from 'http'
import path from 'path'

import { App, Request, Response } from '@tinyhttp/app'
import sirv from 'sirv'

import { log, NETLIFYDEVLOG } from './command-helpers.js'

export const startStaticServer = ({ settings }: { settings: import('./types.js').ServerSettings }) => {
  const rootPath = path.resolve(settings.dist || '')

  const app = new App({
    noMatchHandler: (req, res) => {
      res.status(404).sendFile('400.html', { root: rootPath })
    },
  })
  app.use(sirv(rootPath, { etag: false }))

  app.use((req, res, next) => {
    res.header('age', '0')
    res.header('cache-control', 'public, max-age=0, must-revalidate')
    const validMethods = ['GET', 'HEAD']
    if (req.method && !validMethods.includes(req.method)) {
      res.status(405).send('Method Not Allowed')
    }
    return next?.()
  })

  const server = createServer((req, res) => app.handler(req as Request, res as Response))
  server.listen(settings.frameworkPort)
  const address = server.address()

  if (!address) throw new Error(`Failed to get server address`)
  else if (typeof address === 'string')
    throw new Error(`Server is listening on a UNIX socket, please instead listen on an IP socket`)
  log(`\n${NETLIFYDEVLOG} Static server listening to`, settings.frameworkPort)
  return { family: address.family }
}
