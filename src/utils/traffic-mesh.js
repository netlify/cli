const { EOL } = require('os')
const path = require('path')
const rl = require('readline')

const execa = require('execa')
const waitPort = require('wait-port')

const { shouldFetchLatestVersion, fetchLatestVersion } = require('../lib/exec-fetcher')
const { getPathInHome, getPathInProject } = require('../lib/settings')
const { startSpinner, stopSpinner } = require('../lib/spinner')

const { NETLIFYDEVLOG, NETLIFYDEVERR, NETLIFYDEVWARN } = require('./logo')

const PACKAGE_NAME = 'traffic-mesh-agent'
const EXEC_NAME = 'traffic-mesh'

const LATEST_VERSION = 'v0.22.1'

const EDGE_HANDLERS_BUNDLER_CLI_PATH = path.resolve(require.resolve('@netlify/plugin-edge-handlers'), '..', 'cli.js')

const getBinPath = () => getPathInHome([PACKAGE_NAME, 'bin'])

const installTrafficMesh = async ({ log }) => {
  const binPath = getBinPath()
  const shouldFetch = await shouldFetchLatestVersion({
    binPath,
    packageName: PACKAGE_NAME,
    execArgs: ['--version'],
    pattern: '\\sv(.+)',
    execName: EXEC_NAME,
    latestVersion: LATEST_VERSION,
    log,
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
    latestVersion: LATEST_VERSION,
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
    '--bundler',
    EDGE_HANDLERS_BUNDLER_CLI_PATH,
    '--log-file',
    getPathInProject(['logs', 'traffic-mesh.log']),
    '--progress',
  ]

  if (functionsPort) {
    args.push('--local-services-uri', `http://localhost:${functionsPort}`)
  }

  if (debug) {
    args.push('--debug')
  }

  const { subprocess } = await runProcess({ log, args })
  const forwarder = forwardMessagesToLog({ log, subprocess })

  subprocess.on('close', process.exit)
  subprocess.on('SIGINT', process.exit)
  subprocess.on('SIGTERM', process.exit)
  ;['SIGINT', 'SIGTERM', 'SIGQUIT', 'SIGHUP', 'exit'].forEach((signal) => {
    process.on(signal, () => {
      forwarder.close()

      const sig = signal === 'exit' ? 'SIGTERM' : signal
      subprocess.kill(sig, {
        forceKillAfterTimeout: PROXY_EXIT_TIMEOUT,
      })
    })
  })

  try {
    const open = await waitPort({ port, output: 'silent', timeout: PROXY_READY_TIMEOUT })
    if (!open) {
      throw new Error(`Timed out waiting for forward proxy to be ready on port '${port}'`)
    }
    return `http://localhost:${port}`
  } catch (error) {
    log(`${NETLIFYDEVERR}`, error)
  }
}

const forwardMessagesToLog = ({ log, subprocess }) => {
  let currentId = null
  let spinner = null

  const reset = () => {
    currentId = null
    spinner = null
  }

  const iface = rl.createInterface({
    input: subprocess.stderr,
  })

  iface
    .on('line', (line) => {
      let data
      try {
        data = JSON.parse(line.trim())
      } catch (error) {
        log(`${NETLIFYDEVERR} Cannot parse log line as JSON: ${line.trim()}${EOL}${EOL}${error}`)
        return
      }

      const { error, id, type } = data
      switch (type) {
        case 'bundle:start':
          currentId = id
          if (!spinner) {
            spinner = startSpinner({ text: 'Bundling edge handlers...' })
          }
          break

        case 'bundle:success':
          if (currentId !== id) {
            return
          }

          stopSpinner({ spinner, error: false, text: 'Done.' })
          reset()
          break

        case 'bundle:fail':
          if (currentId !== id) {
            return
          }

          stopSpinner({
            spinner,
            error: true,
            text: (error && error.msg) || 'Failed bundling Edge Handlers',
          })
          log(`${NETLIFYDEVLOG} Change any project file to trigger a re-bundle`)
          reset()
          break

        default:
          log(`${NETLIFYDEVWARN} Unknown mesh-forward event '${type}'`)
          break
      }
    })
    .on('close', () => {
      if (spinner) {
        // Hide the spinner
        spinner.stop()
      }

      reset()
    })
    .on('error', (err) => {
      stopSpinner({
        spinner,
        error: true,
        text: `${NETLIFYDEVERR} An error occured while bundling processing the messages from mesh-forward: ${err}`,
      })

      reset()
    })

  return iface
}

// 30 seconds
const PROXY_READY_TIMEOUT = 3e4
// 2 seconds
const PROXY_EXIT_TIMEOUT = 2e3

const runProcess = async ({ log, args }) => {
  await installTrafficMesh({ log })

  const execPath = path.join(getBinPath(), EXEC_NAME)
  const subprocess = execa(execPath, args, { stdio: ['inherit', 'inherit', 'pipe'] })
  return { subprocess }
}

module.exports = { runProcess, startForwardProxy, installTrafficMesh }
