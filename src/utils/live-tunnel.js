const fetch = require('node-fetch')
const fs = require('fs')
const os = require('os')
const path = require('path')
const execa = require('execa')
const chalk = require('chalk')
const { fetchLatest, updateAvailable } = require('gh-release-fetch')
const {
  NETLIFYDEVLOG,
  // NETLIFYDEVWARN,
  NETLIFYDEVERR,
} = require('./logo')

async function createTunnel(siteId, netlifyApiToken, log) {
  await installTunnelClient(log)

  if (!siteId) {
    // eslint-disable-next-line no-console
    console.error(
      `${NETLIFYDEVERR} Error: no siteId defined, did you forget to run ${chalk.yellow(
        'netlify init'
      )} or ${chalk.yellow('netlify link')}?`
    )
    process.exit(1)
  }
  log(`${NETLIFYDEVLOG} Creating Live Tunnel for ` + siteId)
  const url = `https://api.netlify.com/api/v1/live_sessions?site_id=${siteId}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${netlifyApiToken}`,
    },
    body: JSON.stringify({}),
  })

  const data = await response.json()

  if (response.status !== 201) {
    throw new Error(data.message)
  }

  return data
}

async function connectTunnel(session, netlifyApiToken, localPort, log) {
  const execPath = path.join(os.homedir(), '.netlify', 'tunnel', 'bin', 'live-tunnel-client')
  const args = ['connect', '-s', session.id, '-t', netlifyApiToken, '-l', localPort]
  if (process.env.DEBUG) {
    args.push('-v')
    log(execPath, args)
  }

  const ps = execa(execPath, args, { stdio: 'inherit' })
  ps.on('close', code => process.exit(code))
  ps.on('SIGINT', process.exit)
  ps.on('SIGTERM', process.exit)
}

async function installTunnelClient(log) {
  const win = isWindows()
  const binPath = path.join(os.homedir(), '.netlify', 'tunnel', 'bin')
  const execName = win ? 'live-tunnel-client.exe' : 'live-tunnel-client'
  const execPath = path.join(binPath, execName)
  const newVersion = await fetchTunnelClient(execPath)
  if (!newVersion) {
    return
  }

  log(`${NETLIFYDEVLOG} Installing Live Tunnel Client`)

  const platform = win ? 'windows' : process.platform
  const extension = win ? 'zip' : 'tar.gz'
  const release = {
    repository: 'netlify/live-tunnel-client',
    package: `live-tunnel-client-${platform}-amd64.${extension}`,
    destination: binPath,
    extract: true,
  }
  await fetchLatest(release)
}

async function fetchTunnelClient(execPath) {
  if (!execExist(execPath)) {
    return true
  }

  const { stdout } = await execa(execPath, ['version'])
  if (!stdout) {
    return false
  }

  const match = stdout.match(/^live-tunnel-client\/v?([^\s]+)/)
  if (!match) {
    return false
  }

  return updateAvailable('netlify/live-tunnel-client', match[1])
}

function execExist(binPath) {
  if (!fs.existsSync(binPath)) {
    return false
  }
  const stat = fs.statSync(binPath)
  return stat && stat.isFile() && isExe(stat.mode, stat.gid, stat.uid)
}

function isExe(mode, gid, uid) {
  if (isWindows()) {
    return true
  }

  const isGroup = gid ? process.getgid && gid === process.getgid() : true
  const isUser = uid ? process.getuid && uid === process.getuid() : true

  return Boolean(mode & 0o0001 || (mode & 0o0010 && isGroup) || (mode & 0o0100 && isUser))
}

function isWindows() {
  return process.platform === 'win32'
}

module.exports = {
  createTunnel: createTunnel,
  connectTunnel: connectTunnel,
}
