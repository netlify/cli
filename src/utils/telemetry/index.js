const path = require('path')
const { spawn } = require('child_process')
const isValidEventName = require('./validation')
const GlobalConfig = require('../../base/global-config')
const ci = require('ci-info')

const globalConfig = GlobalConfig.all
const TELEMETRY_DISABLED = globalConfig.telemetryDisabled
const IS_INSIDE_CI = ci.isCI

const DEBUG = false

function send(type, payload) {
  const requestFile = path.join(__dirname, 'request.js')
  const options = JSON.stringify({
    data: payload,
    type: type
  })

  if (DEBUG) {
    console.log(`${type} call`, payload)
    return Promise.resolve()
  }

  // spawn detached child process to handle send
  spawn(process.execPath, [requestFile, options], {
    detached: true,
    stdio: 'ignore'
  }).unref()

  return Promise.resolve()
}

const eventConfig = {
  // Namespace of current application
  projectName: 'cli',
  // Allowed objects
  objects: [
    'sites', // example cli:sites_created
    'user',  // example cli:user_signup
  ]
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
  if (TELEMETRY_DISABLED && !properties.force) {
    if (DEBUG) {
      console.log('Abort .track call TELEMETRY_DISABLED')
    }
    return Promise.resolve()
  }

  const { userId, cliId } = globalConfig

  // automatically add `cli:` prefix if missing
  if (eventName.indexOf('cli:') === -1) {
    eventName = `cli:${eventName}`
  }

  // to ensure clean data, validate event name
  if (!isValidEventName(eventName, eventConfig)) {
    return false
  }

  const defaultProperties = {
    cliId: cliId
  }

  delete properties.force

  const defaultData = {
    event: eventName,
    userId: userId,
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
  if (TELEMETRY_DISABLED && !data.force) {
    if (DEBUG) {
      console.log('Abort .identify call TELEMETRY_DISABLED')
    }    
    return Promise.resolve()
  }


  const userId = globalConfig.userId
  const userProfile = globalConfig.users[`${userId}`]
  const cliId = globalConfig.cliId

  const defaultTraits = {
    name: userProfile.name,
    email: userProfile.email,
    cliId: cliId,
    telemetryDisabled: TELEMETRY_DISABLED
  }

  // remove force key
  delete data.force

  // Payload to send to segment
  const identifyData = {
    anonymousId: cliId,
    userId: userId,
    traits: Object.assign({}, defaultTraits, data),
  }

  return send('identify', identifyData)
}

module.exports = {
  track: track,
  identify: identify
}
