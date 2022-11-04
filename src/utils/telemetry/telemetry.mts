// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'path'.
const path = require('path')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'process'.
const process = require('process')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'isCI'.
const { isCI } = require('ci-info')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'execa'.
const execa = require('../execa.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getGlobalC... Remove this comment to see the full error message
const getGlobalConfig = require('../get-global-config.cjs')

const isValidEventName = require('./validation.cjs')

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const isTelemetryDisabled = function (config: $TSFixMe) {
  return config.get('telemetryDisabled')
}

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const send = function (type: $TSFixMe, payload: $TSFixMe) {
  const requestFile = path.join(__dirname, 'request.cjs')
  const options = JSON.stringify({
    data: payload,
    type,
  })

  const args = [process.execPath, [requestFile, options]]
  if (process.env.NETLIFY_TEST_TELEMETRY_WAIT === 'true') {
    return execa(...args, {
      stdio: 'inherit',
    })
  }

  // spawn detached child process to handle send
  execa(...args, {
    detached: true,
    stdio: 'ignore',
  }).unref()
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

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'track'.
const track = async function (eventName: $TSFixMe, payload = {}) {
  if (isCI) {
    return
  }

  const globalConfig = await getGlobalConfig()
  if (isTelemetryDisabled(globalConfig)) {
    return
  }

  const [userId, cliId] = [globalConfig.get('userId'), globalConfig.get('cliId')]

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

  // @ts-expect-error TS(2339): Property 'duration' does not exist on type '{}'.
  const { duration, status, ...properties } = payload
  const defaultData = {
    event: eventName,
    userId,
    anonymousId: cliId,
    duration,
    status,
    properties,
  }

  return send('track', defaultData)
}

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const identify = async function (payload: $TSFixMe) {
  if (isCI) {
    return
  }

  const globalConfig = await getGlobalConfig()
  if (isTelemetryDisabled(globalConfig)) {
    return
  }

  const cliId = globalConfig.get('cliId')
  const { email, name, userId } = payload

  const defaultTraits = {
    name,
    email,
    cliId,
  }

  const identifyData = {
    anonymousId: cliId,
    userId,
    traits: { ...defaultTraits, ...payload },
  }

  return send('identify', identifyData)
}

module.exports = {
  track,
  identify,
}
