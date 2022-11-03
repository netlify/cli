// @ts-check
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'process'.
const process = require('process')

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'fetch'.
const fetch = require('node-fetch')
// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const pWaitFor = require('p-wait-for')

// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const { fetchLatestVersion, shouldFetchLatestVersion } = require('../lib/exec-fetcher.cjs')
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'getPathInH... Remove this comment to see the full error message
const { getPathInHome } = require('../lib/settings.cjs')

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'NETLIFYDEV... Remove this comment to see the full error message
const { NETLIFYDEVERR, NETLIFYDEVLOG, chalk, log } = require('./command-helpers.cjs')
// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'execa'.
const execa = require('./execa.cjs')

const PACKAGE_NAME = 'live-tunnel-client'
const EXEC_NAME = PACKAGE_NAME

// 1 second
const TUNNEL_POLL_INTERVAL = 1e3
// 5 minutes
const TUNNEL_POLL_TIMEOUT = 3e5

const createTunnel = async function ({
  netlifyApiToken,
  siteId
}: any) {
  await installTunnelClient()

  if (!siteId) {
    console.error(
      `${NETLIFYDEVERR} Error: no siteId defined, did you forget to run ${chalk.yellow(
        'netlify init',
      )} or ${chalk.yellow('netlify link')}?`,
    )
    process.exit(1)
  }
  log(`${NETLIFYDEVLOG} Creating Live Tunnel for ${siteId}`)
  const url = `https://api.netlify.com/api/v1/live_sessions?site_id=${siteId}`

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

const connectTunnel = function ({
  localPort,
  netlifyApiToken,
  session
}: any) {
  const execPath = getPathInHome(['tunnel', 'bin', EXEC_NAME])
  const args = ['connect', '-s', session.id, '-t', netlifyApiToken, '-l', localPort]
  if (process.env.DEBUG) {
    args.push('-v')
    log(execPath, args)
  }

  const ps = execa(execPath, args, { stdio: 'inherit' })
  ps.on('close', (code: any) => process.exit(code))
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

const startLiveTunnel = async ({
  localPort,
  netlifyApiToken,
  siteId
}: any) => {
  const session = await createTunnel({
    siteId,
    netlifyApiToken,
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

  await connectTunnel({ session, netlifyApiToken, localPort })

  // Waiting for the live session to have a state of `online`.
  await pWaitFor(isLiveTunnelReady, {
    interval: TUNNEL_POLL_INTERVAL,
    timeout: TUNNEL_POLL_TIMEOUT,
  })

  return session.session_url
}

// @ts-expect-error TS(2580) FIXME: Cannot find name 'module'. Do you need to install ... Remove this comment to see the full error message
module.exports = { startLiveTunnel }
