const process = require('process')

const { startExternalServer } = require('./external-server.cjs')

const port = Number.parseInt(process.argv[2])

if (Number.isNaN(port)) {
  throw new TypeError(`Invalid port`)
}

console.log('Running external server on port', port, process.env.NETLIFY_DEV)

startExternalServer({ port })
