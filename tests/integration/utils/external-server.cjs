const express = require('express')

const startExternalServer = () => {
  const app = express()
  app.use(express.urlencoded({ extended: true }))
  app.all('*', function onRequest(req, res) {
    res.json({ url: req.url, body: req.body, method: req.method })
  })

  return app.listen()
}

module.exports = {
  startExternalServer,
}
