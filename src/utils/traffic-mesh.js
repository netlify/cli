const path = require('path')
const execa = require('execa')
const waitPort = require('wait-port')
const { NETLIFYDEVLOG, NETLIFYDEVERR } = require('./logo')
const { getPathInHome } = require('../lib/settings')
const { shouldFetchLatestVersion, fetchLatestVersion } = require('../lib/exec-fetcher')

const PACKAGE_NAME = 'traffic-mesh'

const getBinPath = () => getPathInHome([PACKAGE_NAME, 'bin'])

const installTrafficMesh = async ({ log }) => {
  try {
    const binPath = getBinPath()
    const shouldFetch = await shouldFetchLatestVersion({
      binPath,
      packageName: PACKAGE_NAME,
      execArgs: ['--version'],
      pattern: '\\sv(.+)',
    })
    if (!shouldFetch) {
      return
    }

    log(`${NETLIFYDEVLOG} Installing Traffic Mesh`)

    await fetchLatestVersion({
      packageName: PACKAGE_NAME,
      destination: binPath,
    })
  } catch (e) {
    // This is expected to fail until we publish releases in a public repo
    log(`${NETLIFYDEVERR}`, e)
  }
}

const startForwardProxy = async ({ port, frameworkPort, projectDir, log, debug }) => {
  await installTrafficMesh({ log })
  const args = ['start', '--port', port, '--forward-proxy', `http://localhost:${frameworkPort}`, '--watch', projectDir]

  if (debug) {
    args.push('--debug')
  }

  const execPath = path.join(getBinPath(), PACKAGE_NAME)
  const subprocess = execa(execPath, args, { stdio: 'inherit' })

  subprocess.on('close', process.exit)
  subprocess.on('SIGINT', process.exit)
  subprocess.on('SIGTERM', process.exit)
  ;['SIGINT', 'SIGTERM', 'SIGQUIT', 'SIGHUP', 'exit'].forEach(signal =>
    process.on(signal, () => {
      const sig = signal == 'exit' ? 'SIGTERM' : signal
      subprocess.kill(sig, {
        forceKillAfterTimeout: 2000,
      })
    })
  )

  try {
    const open = await waitPort({ port, output: 'silent', timeout: 30 * 1000 })
    if (!open) {
      throw new Error(`Timed out waiting for forward proxy to be ready on port '${port}'`)
    }
    return `http://localhost:${port}`
  } catch (e) {
    log(`${NETLIFYDEVERR}`, e)
  }
}

module.exports = { startForwardProxy }
