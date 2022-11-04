// @ts-check

const path = require('path')

const process = require('process')


const { isCI } = require('ci-info')


const execa = require('../execa.mjs')

const getGlobalConfig = require('../get-global-config.mjs')

const isValidEventName = require('./validation.mjs')


const isTelemetryDisabled = function (config: $TSFixMe) {
  return config.get('telemetryDisabled')
}


const send = function (type: $TSFixMe, payload: $TSFixMe) {
  const requestFile = path.join(__dirname, 'request.mjs')
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

export default {
  track,
  identify,
}
