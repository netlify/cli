const path = require('path')
const execa = require('execa')
const waitPort = require('wait-port')
const { NETLIFYDEVLOG, NETLIFYDEVERR } = require('./logo')
const { getPathInHome, getPathInProject } = require('../lib/settings')
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

const startForwardProxy = async ({ port, frameworkPort, functionsPort, publishDir, log, debug }) => {
  const args = [
    'start',
    'local',
    '--port',
    port,
    '--forward-proxy',
    `http://localhost:${frameworkPort}`,
    '--watch',
    publishDir,
    '--log-file',
    getPathInProject(['logs', 'traffic-mesh.log']),
  ]

  if (functionsPort) {
    args.push('--local-services-uri', `http://localhost:${functionsPort}`)
  }

  if (debug) {
    args.push('--debug')
  }

  const { subprocess } = await runProcess({ log, args })

  subprocess.on('close', process.exit)
  subprocess.on('SIGINT', process.exit)
  subprocess.on('SIGTERM', process.exit)
  ;['SIGINT', 'SIGTERM', 'SIGQUIT', 'SIGHUP', 'exit'].forEach(signal =>
    process.on(signal, () => {
      const sig = signal === 'exit' ? 'SIGTERM' : signal
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
  } catch (error) {
    log(`${NETLIFYDEVERR}`, error)
  }
}

const runProcess = async ({ log, args }) => {
  await installTrafficMesh({ log })

  const execPath = path.join(getBinPath(), EXEC_NAME)
  const subprocess = execa(execPath, args, { stdio: 'inherit' })
  return { subprocess }
}

module.exports = { runProcess, startForwardProxy, installTrafficMesh }
