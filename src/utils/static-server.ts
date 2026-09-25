import path from 'path'

import fastifyStatic from '@fastify/static'
import Fastify from 'fastify'

import { log, NETLIFYDEVLOG } from './command-helpers.js'
import type { ServerSettings } from './types.js'

export const startStaticServer = async ({ settings }: { settings: Pick<ServerSettings, 'dist' | 'frameworkPort'> }) => {
  const server = Fastify()
  const rootPath = path.resolve(settings.dist)
  server.register(fastifyStatic, {
    root: rootPath,
    etag: false,
    acceptRanges: false,
    lastModified: false,
  })

  server.setNotFoundHandler((_req, res) => {
    res.code(404).sendFile('404.html', rootPath)
  })

  server.addHook('onRequest', (req, reply, done) => {
    reply.header('age', '0')
    reply.header('cache-control', 'public, max-age=0, must-revalidate')
    const validMethods = ['GET', 'HEAD']
    if (!validMethods.includes(req.method)) {
      reply.code(405).send('Method Not Allowed')
    }
    done()
  })
  await server.listen({ port: settings.frameworkPort })
  const [address] = server.addresses()
  // @ts-expect-error FIXME: `log()` types its format args as strings, but `util.format()` accepts any value
  log(`\n${NETLIFYDEVLOG} Static server listening to`, settings.frameworkPort)
  return { family: address.family }
}
