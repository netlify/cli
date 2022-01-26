// @ts-check
import process from 'process'
import { fileURLToPath } from 'url'

import { isCI } from 'ci-info'
import { execa } from 'execa'

import getGlobalConfig from '../get-global-config.js'

import isValidEventName from './validation.js'

const isTelemetryDisabled = function (config) {
  return config.get('telemetryDisabled')
}

const send = function (type, payload) {
  const requestFile = fileURLToPath(new URL('request.js', import.meta.url).pathname)
  const options = JSON.stringify({
    data: payload,
    type,
  })

  const args = [requestFile, options]
  if (process.env.NETLIFY_TEST_TELEMETRY_WAIT === 'true') {
    return execa(process.execPath, args, {
      stdio: 'inherit',
    })
  }

  // spawn detached child process to handle send
  execa(process.execPath, args, {
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

export const track = async function (eventName, payload = {}) {
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

export const identify = async function (payload) {
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
