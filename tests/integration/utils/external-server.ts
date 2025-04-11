import { env } from 'process'

// @ts-expect-error TS(1259) FIXME: Module '"/home/ndhoule/dev/src/github.com/netlify/... Remove this comment to see the full error message
import express from 'express'

export const startExternalServer = ({ host, port }: any = {}) => {
  const app = express()
  app.use(express.urlencoded({ extended: true }))
  app.all('*', function onRequest(req, res) {
    res.json({ url: req.url, body: req.body, method: req.method, headers: req.headers, env })
  })

  return app.listen({ port, host })
}
