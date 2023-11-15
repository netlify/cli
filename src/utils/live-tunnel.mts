 
import process from 'process'

// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'node... Remove this comment to see the full error message
import fetch from 'node-fetch'
import pWaitFor from 'p-wait-for'
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'uuid... Remove this comment to see the full error message
import { v4 as uuidv4 } from 'uuid'

import { fetchLatestVersion, shouldFetchLatestVersion } from '../lib/exec-fetcher.mjs'
import { getPathInHome } from '../lib/settings.mjs'

import { NETLIFYDEVERR, NETLIFYDEVLOG, chalk, log } from './command-helpers.mjs'
// @ts-expect-error TS(7034) FIXME: Variable 'execa' implicitly has type 'any' in some... Remove this comment to see the full error message
import execa from './execa.mjs'

const PACKAGE_NAME = 'live-tunnel-client'
const EXEC_NAME = PACKAGE_NAME
const SLUG_LOCAL_STATE_KEY = 'liveTunnelSlug'

// 1 second
const TUNNEL_POLL_INTERVAL = 1e3
// 5 minutes
const TUNNEL_POLL_TIMEOUT = 3e5

// @ts-expect-error TS(7031) FIXME: Binding element 'netlifyApiToken' implicitly has a... Remove this comment to see the full error message
const createTunnel = async function ({ netlifyApiToken, siteId, slug }) {
  await installTunnelClient()

  if (!siteId) {
    console.error(
      `${NETLIFYDEVERR} Error: no siteId defined, did you forget to run ${chalk.yellow(
        'netlify init',
      )} or ${chalk.yellow('netlify link')}?`,
    )
    process.exit(1)
  }

  const url = `https://api.netlify.com/api/v1/live_sessions?site_id=${siteId}&slug=${slug}`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${netlifyApiToken}`,
    },
    body: JSON.stringify({}),
  })

  const data = await response.json()

  if (response.status !== 201) {
    throw new Error(data.message)
  }

  return data
}

// @ts-expect-error TS(7031) FIXME: Binding element 'localPort' implicitly has an 'any... Remove this comment to see the full error message
const connectTunnel = function ({ localPort, netlifyApiToken, session }) {
  const execPath = getPathInHome(['tunnel', 'bin', EXEC_NAME])
  const args = ['connect', '-s', session.id, '-t', netlifyApiToken, '-l', localPort]
  if (process.env.DEBUG) {
    args.push('-v')
    log(execPath, args)
  }

  // @ts-expect-error TS(7005) FIXME: Variable 'execa' implicitly has an 'any' type.
  const ps = execa(execPath, args, { stdio: 'inherit' })
  // @ts-expect-error TS(7006) FIXME: Parameter 'code' implicitly has an 'any' type.
  ps.on('close', (code) => process.exit(code))
  ps.on('SIGINT', process.exit)
  ps.on('SIGTERM', process.exit)
}

const installTunnelClient = async function () {
  const binPath = getPathInHome(['tunnel', 'bin'])
  // @ts-expect-error TS(2345) FIXME: Argument of type '{ binPath: string; packageName: ... Remove this comment to see the full error message
  const shouldFetch = await shouldFetchLatestVersion({
    binPath,
    packageName: PACKAGE_NAME,
    execArgs: ['version'],
    pattern: `${PACKAGE_NAME}\\/v?([^\\s]+)`,
    execName: EXEC_NAME,
  })
  if (!shouldFetch) {
    return
  }

  log(`${NETLIFYDEVLOG} Installing Live Tunnel Client`)

  // @ts-expect-error TS(2345) FIXME: Argument of type '{ packageName: string; execName:... Remove this comment to see the full error message
  await fetchLatestVersion({
    packageName: PACKAGE_NAME,
    execName: EXEC_NAME,
    destination: binPath,
    extension: process.platform === 'win32' ? 'zip' : 'tar.gz',
  })
}

// @ts-expect-error TS(7031) FIXME: Binding element 'localPort' implicitly has an 'any... Remove this comment to see the full error message
export const startLiveTunnel = async ({ localPort, netlifyApiToken, siteId, slug }) => {
  const session = await createTunnel({
    siteId,
    netlifyApiToken,
    slug,
  })

  const isLiveTunnelReady = async function () {
    const url = `https://api.netlify.com/api/v1/live_sessions/${session.id}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${netlifyApiToken}`,
      },
    })
    const data = await response.json()

    if (response.status !== 200) {
      throw new Error(data.message)
    }

    return data.state === 'online'
  }

  connectTunnel({ session, netlifyApiToken, localPort })

  // Waiting for the live session to have a state of `online`.
  await pWaitFor(isLiveTunnelReady, {
    interval: TUNNEL_POLL_INTERVAL,
    timeout: TUNNEL_POLL_TIMEOUT,
  })

  return session.session_url
}

// @ts-expect-error TS(7006) FIXME: Parameter 'state' implicitly has an 'any' type.
export const getLiveTunnelSlug = (state, override) => {
  if (override !== undefined) {
    return override
  }

  const newSlug = generateRandomSlug()

  try {
    const existingSlug = state.get(SLUG_LOCAL_STATE_KEY)

    if (existingSlug !== undefined) {
      return existingSlug
    }

    state.set(SLUG_LOCAL_STATE_KEY, newSlug)
  } catch (error) {
    // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
    log(`${NETLIFYDEVERR} Could not read or write local state file: ${error.message}`)
  }

  return newSlug
}

const generateRandomSlug = () => uuidv4().slice(0, 8)
