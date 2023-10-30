// @ts-check
// This file is being called by `src/utils/telemetry/telemetry.js` as a child process
// to run a s a detached process
import process from 'process'

import fetch from 'node-fetch'

import getPackageJson from '../get-package-json.mjs'

const { name, version } = await getPackageJson()

const options = JSON.parse(process.argv[2])

const CLIENT_ID = 'NETLIFY_CLI'
const TRACK_URL = process.env.NETLIFY_TEST_TRACK_URL || 'https://cli.netlify.com/telemetry/track'
const IDENTIFY_URL = process.env.NETLIFY_TEST_IDENTIFY_URL || 'https://cli.netlify.com/telemetry/identify'
const REPORT_ERROR_URL = process.env.NETLIFY_TEST_ERROR_REPORT_URL || 'https://cli.netlify.com/report-error'

const getApiUrl = () => {
  switch (options.type) {
    case 'track':
      return TRACK_URL
    case 'error':
      return REPORT_ERROR_URL
    default:
      return IDENTIFY_URL
  }
}

// Make telemetry call
const makeRequest = async function () {
  try {
    await fetch(getApiUrl(), {
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
