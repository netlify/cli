import process from 'process'

import fetch from 'node-fetch'
import pWaitFor from 'p-wait-for'
import { v4 as uuidv4 } from 'uuid'

import { fetchLatestVersion, shouldFetchLatestVersion } from '../lib/exec-fetcher.js'
import { getPathInHome } from '../lib/settings.js'

import { NETLIFYDEVERR, NETLIFYDEVLOG, chalk, log } from './command-helpers.js'
import execa from './execa.js'
import type CLIState from './cli-state.js'

const PACKAGE_NAME = 'live-tunnel-client'
const EXEC_NAME = PACKAGE_NAME
const SLUG_LOCAL_STATE_KEY = 'liveTunnelSlug'

// 1 second
const TUNNEL_POLL_INTERVAL = 1e3
// 5 minutes
const TUNNEL_POLL_TIMEOUT = 3e5

interface LiveSession {
  id: string
  session_url: string
  state: string
}

const createTunnel = async function ({
  netlifyApiToken,
  siteId,
  slug,
}: {
  netlifyApiToken: string
  siteId: string
  slug: string
}) {
  await installTunnelClient()

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
    // @ts-expect-error(serhalp) -- Use typed `netlify` API client?
    throw new Error(data.message)
  }

  return data as LiveSession
}

const connectTunnel = function ({
  localPort,
  netlifyApiToken,
  session,
}: {
  localPort: number
  netlifyApiToken: string
  session: LiveSession
}) {
  const execPath = getPathInHome(['tunnel', 'bin', EXEC_NAME])
  const args = ['connect', '-s', session.id, '-t', netlifyApiToken, '-l', localPort.toString()]
  if (process.env.DEBUG) {
    args.push('-v')
    log(execPath, args.toString())
  }

  const ps = execa(execPath, args, { stdio: 'inherit' })
  ps.on('close', (code) => process.exit(code))
  ps.on('SIGINT', process.exit)
  ps.on('SIGTERM', process.exit)
}

const installTunnelClient = async function () {
  const binPath = getPathInHome(['tunnel', 'bin'])
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

  await fetchLatestVersion({
    packageName: PACKAGE_NAME,
    execName: EXEC_NAME,
    destination: binPath,
    extension: process.platform === 'win32' ? 'zip' : 'tar.gz',
  })
}

export const startLiveTunnel = async ({
  localPort,
  netlifyApiToken,
  siteId,
  slug,
}: {
  localPort: number
  netlifyApiToken?: string | null | undefined
  siteId?: string | undefined
  slug: string
}) => {
  if (!siteId) {
    console.error(
      `${NETLIFYDEVERR} Error: no siteId defined, did you forget to run ${chalk.yellow(
        'netlify init',
      )} or ${chalk.yellow('netlify link')}?`,
    )
    process.exit(1)
  }

  const session = await createTunnel({
    siteId,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- XXX(serhalp): removed in favor of runtime user feedback in stacked PR
    netlifyApiToken: netlifyApiToken!,
    slug,
  })

  const isLiveTunnelReady = async (): Promise<boolean> => {
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
      // @ts-expect-error(serhalp) -- Use typed `netlify` API client?
      throw new Error(data.message)
    }

    return (data as LiveSession).state === 'online'
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- XXX(serhalp): removed in favor of runtime user feedback in stacked PR
  connectTunnel({ session, netlifyApiToken: netlifyApiToken!, localPort })

  // Waiting for the live session to have a state of `online`.
  await pWaitFor(isLiveTunnelReady, {
    interval: TUNNEL_POLL_INTERVAL,
    timeout: TUNNEL_POLL_TIMEOUT,
  })

  return session.session_url
}

export const getLiveTunnelSlug = (state: CLIState, override?: string) => {
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
    log(
      `${NETLIFYDEVERR} Could not read or write local state file: ${
        error instanceof Error ? error.message : error?.toString() ?? ''
      }`,
    )
  }

  return newSlug
}

const generateRandomSlug = () => uuidv4().slice(0, 8)
