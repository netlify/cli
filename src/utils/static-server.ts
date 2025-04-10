import { statSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import fastifyStatic from '@fastify/static'
import Fastify from 'fastify'

import { log, NETLIFYDEVLOG } from './command-helpers.js'

const cwd = path.dirname(fileURLToPath(import.meta.url))
const default404Template = path.resolve(cwd, '../lib/templates/404.html')

/**
 * @param {object} config
 * @param {import('./types.js').ServerSettings} config.settings
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'settings' implicitly has an 'any'... Remove this comment to see the full error message
export const startStaticServer = async ({ settings }) => {
  const server = Fastify()
  const rootPath = path.resolve(settings.dist)
  server.register(fastifyStatic, {
    root: rootPath,
    etag: false,
    acceptRanges: false,
    lastModified: false,
  })

  server.setNotFoundHandler((_req, res) => {
    let pagePath = default404Template

    try {
      const custom404Path = path.join(settings.dist, '404.html')
      const stats = statSync(custom404Path)

      if (stats.isFile()) {
        pagePath = custom404Path
      }
    } catch {
      // no-op
    }

    res.code(404).sendFile(path.basename(pagePath), path.dirname(pagePath))
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
  log(`\n${NETLIFYDEVLOG} Static server listening to`, settings.frameworkPort)
}
