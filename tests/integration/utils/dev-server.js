const path = require('path')
const process = require('process')

const execa = require('execa')
const getPort = require('get-port')
const omit = require('omit.js').default
const pTimeout = require('p-timeout')

const cliPath = require('./cli-path')
const { handleQuestions } = require('./handle-questions')
const { killProcess } = require('./process')

const ENVS_TO_OMIT = ['LANG', 'LC_ALL']

const getExecaOptions = ({ cwd, env }) => ({
  cwd,
  extendEnv: false,
  env: { ...omit(process.env, ENVS_TO_OMIT), BROWSER: 'none', ...env },
  encoding: 'utf8',
})

const startServer = async ({ cwd, offline = true, env = {}, args = [], expectFailure = false, prompt }) => {
  const port = await getPort()
  const staticPort = await getPort()
  const host = 'localhost'
  const url = `http://${host}:${port}`

  console.log(`Starting dev server on port: ${port} in directory ${path.basename(cwd)}`)

  const ps = execa(
    cliPath,
    ['dev', offline ? '--offline' : '', '-p', port, '--staticServerPort', staticPort, ...args],
    getExecaOptions({ cwd, env }),
  )

  const promptHistory = []

  if (prompt) {
    handleQuestions(ps, prompt, promptHistory)
  }

  const outputBuffer = []
  const errorBuffer = []
  const serverPromise = new Promise((resolve, reject) => {
    let selfKilled = false
    ps.stderr.on('data', (data) => {
      errorBuffer.push(data)
    })
    ps.stdout.on('data', (data) => {
      outputBuffer.push(data)
      if (!expectFailure && data.includes('Edge function server running')) {
        resolve({
          url,
          host,
          port,
          errorBuffer,
          outputBuffer,
          close: async () => {
            selfKilled = true
            await killProcess(ps)
          },
          promptHistory,
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
      const { timeout, ...server } = await startServer({ ...options, expectFailure })
      if (timeout) {
        throw new Error(`Timed out starting dev server.\nServer Output:\n${server.outputBuffer.join('')}`)
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
  } catch (error) {
    if (server) {
      console.log(server.outputBuffer.join(''))
      console.log(server.errorBuffer.join(''))
    }
    throw error
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
