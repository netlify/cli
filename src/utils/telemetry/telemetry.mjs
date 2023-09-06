// @ts-check
import { dirname, join } from 'path'
import process, { version as nodejsVersion } from 'process'
import { fileURLToPath } from 'url'

import { isCI } from 'ci-info'

import execa from '../execa.mjs'
import getGlobalConfig from '../get-global-config.mjs'

import { isTelemetryDisabled, cliVersion } from './utils.mjs'
import isValidEventName from './validation.mjs'

const dirPath = dirname(fileURLToPath(import.meta.url))

/**
 * @param {'track' | 'identify'} type
 * @param {object} payload
 */
function send(type, payload) {
  const requestFile = join(dirPath, 'request.mjs')
  const options = JSON.stringify({
    data: payload,
    type,
  })

  const args = /** @type {const} */ ([process.execPath, [requestFile, options]])
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

/**
 * Tracks a custom event with the provided payload
 * @param {string} eventName
 * @param {{status?: string, duration?: number, [key: string]: unknown}} [payload]
 */
export async function track(eventName, payload = {}) {
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
    properties: { ...properties, nodejsVersion, cliVersion },
  }

  return send('track', defaultData)
}

/**
 * @param {object} payload
 * @param {string} payload.name
 * @param {string} payload.email
 * @param {string} payload.userId
 * @returns
 */
export async function identify(payload) {
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
