// @ts-check
// This file is being called by `src/utils/telemetry/telemetry.js` as a child process
// to run a s a detached process
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'process'.
const process = require('process')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'fetch'.
const fetch = require('node-fetch')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'name'.
const { name, version } = require('../../../package.json')

const options = JSON.parse(process.argv[2])

const CLIENT_ID = 'NETLIFY_CLI'
const TRACK_URL = process.env.NETLIFY_TEST_TRACK_URL || 'https://cli.netlify.com/telemetry/track'
const IDENTIFY_URL = process.env.NETLIFY_TEST_IDENTIFY_URL || 'https://cli.netlify.com/telemetry/identify'

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'API_URL'.
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
  } catch {
    process.exit(1)
  }
}

makeRequest()
