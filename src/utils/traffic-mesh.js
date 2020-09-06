const path = require('path')
const execa = require('execa')
const waitPort = require('wait-port')
const { NETLIFYDEVLOG, NETLIFYDEVERR } = require('./logo')
const { getPathInHome } = require('../lib/settings')
const { shouldFetchLatestVersion, fetchLatestVersion } = require('../lib/exec-fetcher')

const PACKAGE_NAME = 'traffic-mesh-agent'
const EXEC_NAME = 'traffic-mesh'

const getBinPath = () => getPathInHome([PACKAGE_NAME, 'bin'])

const installTrafficMesh = async ({ log }) => {
  const binPath = getBinPath()
  const shouldFetch = await shouldFetchLatestVersion({
    binPath,
    packageName: PACKAGE_NAME,
    execArgs: ['--version'],
    pattern: '\\sv(.+)',
    execName: EXEC_NAME,
  })
  if (!shouldFetch) {
    return
  }

  log(`${NETLIFYDEVLOG} Installing Traffic Mesh Agent`)

  await fetchLatestVersion({
    packageName: PACKAGE_NAME,
    execName: EXEC_NAME,
    destination: binPath,
    extension: 'zip',
  })
}

const startForwardProxy = async ({ port, frameworkPort, functionsPort, projectDir, log, debug }) => {
  await installTrafficMesh({ log })
  const args = [
    'start',
    'local',
    '--port',
    port,
    '--forward-proxy',
    `http://localhost:${frameworkPort}`,
    '--watch',
    projectDir,
  ]

  if (functionsPort) {
    args.push('--local-services-uri', `http://localhost:${functionsPort}`)
  }

  if (debug) {
    args.push('--debug')
  }

  const execPath = path.join(getBinPath(), EXEC_NAME)
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
