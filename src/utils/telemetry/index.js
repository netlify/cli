const { spawn } = require('child_process')
const path = require('path')
const process = require('process')

const ci = require('ci-info')

const getGlobalConfig = require('../get-global-config')

const isValidEventName = require('./validation')

const IS_INSIDE_CI = ci.isCI

const DEBUG = false

const send = function (type, payload) {
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
    // example cli:sites_created
    'sites',
    // example cli:user_signup
    'user',
  ],
}

const track = async function (eventName, payload) {
  const properties = payload || {}

  if (IS_INSIDE_CI) {
    if (DEBUG) {
      console.log('Abort .identify call inside CI')
    }
    return Promise.resolve()
  }

  const globalConfig = await getGlobalConfig()
  // exit early if tracking disabled
  const TELEMETRY_DISABLED = globalConfig.get('telemetryDisabled')
  if (TELEMETRY_DISABLED && !properties.force) {
    if (DEBUG) {
      console.log('Abort .track call TELEMETRY_DISABLED')
    }
    return Promise.resolve()
  }

  let userId = properties.userID
  let { cliId } = properties

  if (!userId) {
    userId = globalConfig.get('userId')
  }

  if (!cliId) {
    cliId = globalConfig.get('cliId')
  }

  // automatically add `cli:` prefix if missing
  if (!eventName.includes('cli:')) {
    eventName = `cli:${eventName}`
  }

  // event 'cli:command' bypasses validation
  const isValid = eventName === 'cli:command' ? () => true : isValidEventName
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
    properties: { ...defaultProperties, ...properties },
  }

  return send('track', defaultData)
}

const identify = async function (payload) {
  const data = payload || {}

  if (IS_INSIDE_CI) {
    if (DEBUG) {
      console.log('Abort .identify call inside CI')
    }
    return Promise.resolve()
  }

  const globalConfig = await getGlobalConfig()
  // exit early if tracking disabled
  const TELEMETRY_DISABLED = globalConfig.get('telemetryDisabled')
  if (TELEMETRY_DISABLED && !data.force) {
    if (DEBUG) {
      console.log('Abort .identify call TELEMETRY_DISABLED')
    }
    return Promise.resolve()
  }

  let userId = data.userID
  let { cliId } = data

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
    traits: { ...defaultTraits, ...data },
  }

  return send('identify', identifyData)
}

module.exports = {
  track,
  identify,
}
