const path = require('path')
const process = require('process')

const execa = require('execa')
const getPort = require('get-port')
const omit = require('omit.js').default
const pTimeout = require('p-timeout')
const seedrandom = require('seedrandom')

const cliPath = require('./cli-path')
const { killProcess } = require('./process')

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

const ENVS_TO_OMIT = ['LANG', 'LC_ALL']

const getExecaOptions = ({ cwd, env }) => ({
  cwd,
  extendEnv: false,
  env: { ...omit(process.env, ENVS_TO_OMIT), BROWSER: 'none', ...env },
  encoding: 'utf8',
})

const startServer = async ({ cwd, offline = true, env = {}, args = [] }) => {
  const tryPort = currentPort
  currentPort += 1
  const port = await getPort({ port: tryPort })
  const host = 'localhost'
  const url = `http://${host}:${port}`
  console.log(`Starting dev server on port: ${port} in directory ${path.basename(cwd)}`)
  const ps = execa(
    cliPath,
    ['dev', offline ? '--offline' : '', '-p', port, '--staticServerPort', port + FRAMEWORK_PORT_SHIFT, ...args],
    getExecaOptions({ cwd, env }),
  )
  const outputBuffer = []
  const serverPromise = new Promise((resolve, reject) => {
    let selfKilled = false
    ps.stdout.on('data', (data) => {
      outputBuffer.push(data)
      if (data.includes('Server now ready on')) {
        resolve({
          url,
          host,
          port,
          output: outputBuffer.join(''),
          outputBuffer,
          close: async () => {
            selfKilled = true
            await killProcess(ps)
          },
        })
      }
    })
    // eslint-disable-next-line promise/prefer-await-to-callbacks,promise/prefer-await-to-then
    ps.catch((error) => !selfKilled && reject(error))
  })

  return await pTimeout(serverPromise, SERVER_START_TIMEOUT, () => ({ timeout: true, output: outputBuffer.join('') }))
}

const startDevServer = async (options, expectFailure) => {
  const maxAttempts = 5
  // eslint-disable-next-line fp/no-loops
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const { timeout, ...server } = await startServer(options)
      if (timeout) {
        throw new Error(`Timed out starting dev server.\nServer Output:\n${server.output}`)
      }
      return server
    } catch (error) {
      if (attempt === maxAttempts || expectFailure) {
        throw error
      }
      console.warn('Retrying startDevServer', error)
    }
  }
}

// 240 seconds
const SERVER_START_TIMEOUT = 24e4

const withDevServer = async (options, testHandler, expectFailure = false) => {
  let server
  try {
    server = await startDevServer(options, expectFailure)
    return await testHandler(server)
  } finally {
    if (server) {
      await server.close()
    }
  }
}

const tryAndLogOutput = async (func, outputBuffer) => {
  try {
    await func()
  } catch (error) {
    console.log(outputBuffer.join(''))
    throw error
  }
}

module.exports = {
  withDevServer,
  startDevServer,
  getExecaOptions,
  tryAndLogOutput,
}
