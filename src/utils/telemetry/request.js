// Spawn a detached process
const process = require('process')

const fetch = require('node-fetch')

const { name, version } = require('../../../package.json')

const options = JSON.parse(process.argv[2])

const CLIENT_ID = 'NETLIFY_CLI'
const TRACK_URL = process.env.NETLIFY_TEST_TRACK_URL || 'https://cli.netlify.com/telemetry/track'
const IDENTIFY_URL = process.env.NETLIFY_TEST_IDENTIFY_URL || 'https://cli.netlify.com/telemetry/identify'

const API_URL = options.type && options.type === 'track' ? TRACK_URL : IDENTIFY_URL

// Make telemetry call
const makeRequest = async function () {
  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Netlify-Client': CLIENT_ID,
        'User-Agent': `${name}/${version}`,
      },
      body: JSON.stringify(options.data),
    })
    process.exit()
  } catch (error) {
    process.exit(1)
  }
}

makeRequest()
