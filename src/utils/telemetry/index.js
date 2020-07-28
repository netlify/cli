const path = require('path')
const { spawn } = require('child_process')
const isValidEventName = require('./validation')
const globalConfig = require('../global-config')
const ci = require('ci-info')

const IS_INSIDE_CI = ci.isCI

const DEBUG = false

function send(type, payload) {
  const requestFile = path.join(__dirname, 'request.js')
  const options = JSON.stringify({
    data: payload,
    type,
  })

  if (DEBUG) {
    console.log(`${type} call`, payload)
    return Promise.resolve()
  }

  // spawn detached child process to handle send
  spawn(process.execPath, [requestFile, options], {
    detached: true,
    stdio: 'ignore',
  }).unref()

  return Promise.resolve()
}

const eventConfig = {
  // Namespace of current application
  projectName: 'cli',
  // Allowed objects
  objects: [
    'sites', // example cli:sites_created
    'user', // example cli:user_signup
  ],
}

function track(eventName, payload) {
  const properties = payload || {}

  if (IS_INSIDE_CI) {
    if (DEBUG) {
      console.log('Abort .identify call inside CI')
    }
    return Promise.resolve()
  }

  // exit early if tracking disabled
  const TELEMETRY_DISABLED = globalConfig.get('telemetryDisabled')
  if (TELEMETRY_DISABLED && !properties.force) {
    if (DEBUG) {
      console.log('Abort .track call TELEMETRY_DISABLED')
    }
    return Promise.resolve()
  }

  let userId = properties.userID
  let cliId = properties.cliId

  if (!userId) {
    userId = globalConfig.get('userId')
  }

  if (!cliId) {
    cliId = globalConfig.get('cliId')
  }

  // automatically add `cli:` prefix if missing
  if (eventName.indexOf('cli:') === -1) {
    eventName = `cli:${eventName}`
  }

  const allowed = () => true
  // event 'cli:command' bypasses validation
  const isValid = eventName === 'cli:command' ? allowed : isValidEventName
  // to ensure clean data, validate event name
  if (!isValid(eventName, eventConfig)) {
    return false
  }

  const defaultProperties = {
    // cliId: cliId
  }

  delete properties.force

  const defaultData = {
    event: eventName,
    userId,
    anonymousId: cliId,
    properties: Object.assign({}, defaultProperties, properties),
  }

  return send('track', defaultData)
}

function identify(payload) {
  const data = payload || {}

  if (IS_INSIDE_CI) {
    if (DEBUG) {
      console.log('Abort .identify call inside CI')
    }
    return Promise.resolve()
  }

  // exit early if tracking disabled
  const TELEMETRY_DISABLED = globalConfig.get('telemetryDisabled')
  if (TELEMETRY_DISABLED && !data.force) {
    if (DEBUG) {
      console.log('Abort .identify call TELEMETRY_DISABLED')
    }
    return Promise.resolve()
  }

  let userId = data.userID
  let cliId = data.cliId

  if (!userId) {
    userId = globalConfig.get('userId')
  }

  if (!cliId) {
    cliId = globalConfig.get('cliId')
  }

  const userProfile = globalConfig.get(`users.${userId}`)

  const defaultTraits = {
    name: userProfile.name,
    email: userProfile.email,
    cliId,
    telemetryDisabled: TELEMETRY_DISABLED,
  }

  // remove force key
  delete data.force

  // Payload to send to segment
  const identifyData = {
    anonymousId: cliId,
    userId,
    traits: Object.assign({}, defaultTraits, data),
  }

  return send('identify', identifyData)
}

module.exports = {
  track,
  identify,
}
