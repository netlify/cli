import path from 'path'
import process from 'process'

import execa from 'execa'
import getPort from 'get-port'
import pTimeout from 'p-timeout'

import { cliPath } from './cli-path.js'
import { handleQuestions } from './handle-questions.js'
import { killProcess } from './process.js'

export const getExecaOptions = ({ cwd, env }) => {
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

export interface DevServer {
  url: string
  host: string
  port: number
  errorBuffer: any[]
  outputBuffer: any[]
  waitForLogMatching(match: string): Promise<void>
  output: string
  error: string
  close(): Promise<void>
  promptHistory: any[]
}

type $FIXME = any

interface DevServerOptions {
  args?: string[]
  context?: string
  cwd: string
  debug?: boolean
  env?: Record<string, string>
  expectFailure?: boolean
  offline?: boolean
  prompt?: $FIXME[]
  serve?: boolean
  host?: string
}

const startServer = async ({
  args = [],
  context = 'dev',
  cwd,
  debug = false,
  env = {},
  expectFailure = false,
  host,
  offline = true,
  prompt,
  serve = false,
}: DevServerOptions): Promise<DevServer | { timeout: boolean; output: string }> => {
  const port = await getPort()
  const staticPort = await getPort()
  const usedHost = host || 'localhost'
  const url = `http://${usedHost}:${port}`

  console.log(`Starting dev server on port: ${port} in directory ${path.basename(cwd)}`)

  const baseCommand = serve ? 'serve' : 'dev'
  const baseArgs = [
    baseCommand,
    offline ? '--offline' : '',
    '-p',
    port,
    '--staticServerPort',
    staticPort,
    debug ? '--debug' : '',
  ]

  // We use `null` to override the default context and actually omit the flag
  // from the command, which is useful in some test scenarios.
  if (context !== null) {
    baseArgs.push('--context', context)
  }

  // @ts-expect-error FIXME
  const ps = execa(cliPath, [...baseArgs, ...args], getExecaOptions({ cwd, env }))

  if (process.env.DEBUG_TESTS) {
    ps.stderr!.pipe(process.stderr)
    ps.stdout!.pipe(process.stdout)
  }

  const promptHistory = []

  if (prompt) {
    handleQuestions(ps, prompt, promptHistory)
  }

  const outputBuffer: any[] = []
  const errorBuffer: any[] = []
  const serverPromise = new Promise<DevServer>((resolve, reject) => {
    let selfKilled = false
    ps.stderr!.on('data', (data) => {
      errorBuffer.push(data)
    })
    ps.stdout!.on('data', (data) => {
      outputBuffer.push(data)
      if (!expectFailure && data.includes('Server now ready on')) {
        setImmediate(() =>
          resolve({
            url,
            host: usedHost,
            port,
            errorBuffer,
            outputBuffer,
            waitForLogMatching(match: string) {
              // eslint-disable-next-line promise/param-names
              return new Promise<void>((resolveWait) => {
                const listener = (stdoutData: string) => {
                  if (stdoutData.includes(match)) {
                    ps.removeListener('data', listener)
                    resolveWait()
                  }
                }
                ps.stdout!.on('data', listener)
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

export const startDevServer = async (options: DevServerOptions, expectFailure: boolean): Promise<DevServer> => {
  const maxAttempts = 5

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // do not use destruction, as we use getters which otherwise would be evaluated here
      const devServer = await startServer({ ...options, expectFailure })
      // @ts-expect-error FIXME
      if (devServer.timeout) {
        throw new Error(`Timed out starting dev server.\nServer Output:\n${devServer.output}`)
      }
      // @ts-expect-error FIXME
      return devServer
    } catch (error) {
      if (attempt === maxAttempts || expectFailure) {
        throw error
      }
      console.warn('Retrying startDevServer', error)
    }
  }

  throw new Error('this code should be unreachable')
}

// 240 seconds
const SERVER_START_TIMEOUT = 24e4

export const withDevServer = async <T>(
  options: DevServerOptions,
  testHandler: (server: DevServer) => Promise<T>,
  expectFailure = false,
): Promise<T> => {
  let server: DevServer | undefined = undefined
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

export const tryAndLogOutput = async (func, outputBuffer) => {
  try {
    await func()
  } catch (error) {
    console.log(outputBuffer.join(''))
    throw error
  }
}
