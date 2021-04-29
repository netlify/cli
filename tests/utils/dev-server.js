const path = require('path')
const process = require('process')

const execa = require('execa')
const getPort = require('get-port')
const pTimeout = require('p-timeout')
const pidtree = require('pidtree')
const seedrandom = require('seedrandom')

const cliPath = require('./cli-path')

// each process gets a starting port based on the pid
const rng = seedrandom(`${process.pid}`)
const getRandomPortStart = function () {
  const startPort = Math.floor(rng() * RANDOM_PORT_SHIFT) + RANDOM_PORT_SHIFT
  return startPort
}

// To avoid collisions with frameworks ports
const RANDOM_PORT_SHIFT = 1e4
const FRAMEWORK_PORT_SHIFT = 1e3

let currentPort = getRandomPortStart()

const startServer = async ({ cwd, env = {}, args = [] }) => {
  const tryPort = currentPort
  currentPort += 1
  const port = await getPort({ port: tryPort })
  const host = 'localhost'
  const url = `http://${host}:${port}`
  console.log(`Starting dev server on port: ${port} in directory ${path.basename(cwd)}`)
  // In CI we set a NETLIFY_AUTH_TOKEN which means the CLI will hit the live API in some cases
  // as we don't need it for dev tests we can omit it
  // eslint-disable-next-line no-unused-vars
  const { NETLIFY_AUTH_TOKEN, ...processEnv } = process.env
  const ps = execa(cliPath, ['dev', '-p', port, '--staticServerPort', port + FRAMEWORK_PORT_SHIFT, ...args], {
    cwd,
    extendEnv: false,
    env: { ...processEnv, BROWSER: 'none', ...env },
    encoding: 'utf8',
  })
  let output = ''
  const serverPromise = new Promise((resolve, reject) => {
    let selfKilled = false
    ps.stdout.on('data', (data) => {
      output += data
      if (data.includes('Server now ready on')) {
        resolve({
          url,
          host,
          port,
          close: async () => {
            selfKilled = true
            const pids = await pidtree(ps.pid).catch(() => [])
            pids.forEach((pid) => {
              try {
                process.kill(pid)
              } catch (error) {
                // no-op
              }
            })
            ps.kill()
            await pTimeout(
              ps.catch(() => {}),
              SERVER_EXIT_TIMEOUT,
              // don't reject on timeout
              () => {},
            )
          },
        })
      }
    })
    // eslint-disable-next-line promise/prefer-await-to-callbacks
    ps.catch((error) => !selfKilled && reject(error))
  })

  return await pTimeout(serverPromise, SERVER_START_TIMEOUT, () => ({ timeout: true, output }))
}

// One second
const SERVER_EXIT_TIMEOUT = 1e3

const startDevServer = async (options) => {
  const maxAttempts = 5
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const { timeout, output, ...server } = await startServer(options)
      if (timeout) {
        throw new Error(`Timed out starting dev server.\nServer Output:\n${output}`)
      }
      return server
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error
      }
      console.warn('Retrying startDevServer', error)
    }
  }
}

// 240 seconds
const SERVER_START_TIMEOUT = 24e4

const withDevServer = async (options, testHandler) => {
  let server
  try {
    server = await startDevServer(options)
    return await testHandler(server)
  } finally {
    if (server) {
      await server.close()
    }
  }
}

module.exports = {
  withDevServer,
  startDevServer,
}
