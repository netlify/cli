import process from 'process'

import { startExternalServer } from './external-server.js'

const port = Number.parseInt(process.argv[2])

if (Number.isNaN(port)) {
  throw new TypeError(`Invalid port`)
}

console.log('Running external server on port', port, process.env.NETLIFY_DEV)

startExternalServer({ port })
