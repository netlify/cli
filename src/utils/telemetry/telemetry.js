// @ts-check
const path = require('path')
const process = require('process')

const { isCI } = require('ci-info')

const execa = require('../execa')
const getGlobalConfig = require('../get-global-config')

const isValidEventName = require('./validation')

const isTelemetryDisabled = function (config) {
  return config.get('telemetryDisabled')
}

const send = function (type, payload) {
  const requestFile = path.join(__dirname, 'request.js')
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

const track = async function (eventName, payload = {}) {
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

const identify = async function (payload) {
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
