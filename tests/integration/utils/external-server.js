import { env } from 'process'

import { App } from '@tinyhttp/app'
import { urlencoded } from 'milliparsec'

export const startExternalServer = ({ port } = {}) => {
  const app = new App()
  app.use(urlencoded())
  app.all('*', function onRequest(req, res) {
    res.json({ url: req.url, body: req.body, method: req.method, headers: req.headers, env })
  })

  return app.listen({ port })
}
