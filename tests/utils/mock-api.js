const bodyParser = require('body-parser')
const express = require('express')

const startMockApi = ({ routes }) => {
  const app = express()
  app.use(bodyParser.urlencoded({ extended: true }))

  routes.forEach(({ method = 'get', path, response = {}, status = 200 }) => {
    app[method.toLowerCase()](`/api/v1/${path}`, function onRequest(req, res) {
      res.status(status)
      res.json(response)
    })
  })

  app.all('*', function onRequest(req, res) {
    console.warn(`Route not found: ${req.url}`)
    res.status(404)
    res.json({ message: 'Not found' })
  })

  return app.listen()
}

module.exports = { startMockApi }
