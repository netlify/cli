/* eslint no-process-exit: 0 */
// Spawn a detached process
const fetch = require('node-fetch')
const options = JSON.parse(process.argv[2])

const CLIENT_ID = 'NETLIFY_CLI'
const TRACK_URL = 'https://cli.netlify.com/telemetry/track'
const IDENTIFY_URL = 'https://cli.netlify.com/telemetry/identify'

const API_URL = options.type && options.type === 'track' ? TRACK_URL : IDENTIFY_URL

// Make telemetry call
fetch(API_URL, {
  method: 'POST',
  headers: {
    'X-Netlify-Client': CLIENT_ID,
  },
  body: JSON.stringify(options.data),
})
  .then(() => {
    process.exit()
  })
  .catch(() => {
    process.exit(1)
  })
