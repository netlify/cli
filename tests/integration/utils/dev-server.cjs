const path = require('path')
const process = require('process')

const execa = require('execa')
const getPort = require('get-port')
const pTimeout = require('p-timeout')

const cliPath = require('./cli-path.cjs')
const { handleQuestions } = require('./handle-questions.cjs')
const { killProcess } = require('./process.cjs')

const getExecaOptions = ({ cwd, env }) => {
  // Unused vars here are in order to omit LANg and LC_ALL from envs
  // eslint-disable-next-line no-unused-vars
  const { LANG, LC_ALL, ...baseEnv } = process.env

  return {
    cwd,
    extendEnv: false,
    env: { ...baseEnv, BROWSER: 'none', ...env },
    encoding: 'utf8',
  }
}

const startServer = async ({
  args = [],
  context = 'dev',
  cwd,
  env = {},
  expectFailure = false,
  offline = true,
  prompt,
  serve = false,
}) => {
  const port = await getPort()
  const staticPort = await getPort()
  const host = 'localhost'
  const url = `http://${host}:${port}`

  console.log(`Starting dev server on port: ${port} in directory ${path.basename(cwd)}`)

  const baseCommand = serve ? 'serve' : 'dev'
  const baseArgs = [baseCommand, offline ? '--offline' : '', '-p', port, '--staticServerPort', staticPort]

  // We use `null` to override the default context and actually omit the flag
  // from the command, which is useful in some test scenarios.
  if (context !== null) {
    baseArgs.push('--context', context)
  }

  const ps = execa(cliPath, [...baseArgs, ...args], getExecaOptions({ cwd, env }))

  if (process.env.DEBUG_TESTS) {
    ps.stderr.pipe(process.stderr)
    ps.stdout.pipe(process.stdout)
  }

  const promptHistory = []

  if (prompt) {
    handleQuestions(ps, prompt, promptHistory)
  }

  let outputBuffer = []
  const errorBuffer = []
  const serverPromise = new Promise((resolve, reject) => {
    let selfKilled = false
    ps.stderr.on('data', (data) => {
      errorBuffer.push(data)
    })
    ps.stdout.on('data', (data) => {
      outputBuffer.push(data)
      if (!expectFailure && data.includes('Server now ready on')) {
        setImmediate(() =>
          resolve({
            url,
            host,
            port,
            errorBuffer,
            outputBuffer,
            waitForLogMatching(match) {
              // eslint-disable-next-line promise/param-names
              return new Promise((resolveWait) => {
                const listener = (stdoutData) => {
                  if (stdoutData.includes(match)) {
                    ps.removeListener('data', listener)
                    resolveWait()
                  }
                }
                ps.stdout.on('data', listener)
              })
            },
            get output() {
              // these are getters so we do the actual joining as late as possible as the array might still get
              // populated after we resolve here
              return outputBuffer.join('')
            },
            get error() {
              return errorBuffer.join('')
            },
            close: async () => {
              selfKilled = true
              await killProcess(ps)
            },
            reset: () => {
              outputBuffer = []
            },
            promptHistory,
          }),
        )
      }
    })
    // eslint-disable-next-line promise/prefer-await-to-callbacks,promise/prefer-await-to-then
    ps.catch((error) => !selfKilled && reject(error))
  })

  return await pTimeout(serverPromise, SERVER_START_TIMEOUT, () => ({ timeout: true, output: outputBuffer.join('') }))
}

const startDevServer = async (options, expectFailure) => {
  const maxAttempts = 5

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // do not use destruction, as we use getters which otherwise would be evaluated here
      const devServer = await startServer({ ...options, expectFailure })
      if (devServer.timeout) {
        throw new Error(`Timed out starting dev server.\nServer Output:\n${devServer.output}`)
      }
      return devServer
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
    if (server && !expectFailure) {
      error.stdout = server.output
      error.stderr = server.error
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
