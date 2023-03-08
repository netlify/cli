const { env } = require('process')

const express = require('express')

const startExternalServer = ({ port } = {}) => {
  const app = express()
  app.use(express.urlencoded({ extended: true }))
  app.all('*', function onRequest(req, res) {
    res.json({ url: req.url, body: req.body, method: req.method, headers: req.headers, env })
  })

  return app.listen({ port })
}

module.exports = {
  startExternalServer,
}
