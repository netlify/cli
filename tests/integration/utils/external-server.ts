import { env } from 'process'

import express from 'express'

export const startExternalServer = ({ host, port }: { host?: string | undefined; port?: number | undefined } = {}) => {
  const app = express()
  app.use(express.urlencoded({ extended: true }))
  app.all('{*splat}', function onRequest(req, res) {
    res.json({
      url: req.url,
      body: req.body as string,
      method: req.method,
      headers: req.headers,
      env,
    })
  })

  return app.listen({ port, host })
}
