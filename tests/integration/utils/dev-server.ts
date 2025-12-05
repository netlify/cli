import path from 'node:path'
import process from 'node:process'

import { killProcess } from '@netlify/dev-utils'
import execa from 'execa'
import getPort from 'get-port'
import pTimeout from 'p-timeout'

import { cliPath } from './cli-path.js'
import { handleQuestions } from './handle-questions.js'

export const getExecaOptions = ({ cwd, env }: { cwd: string; env: NodeJS.ProcessEnv }) => {
  // Unused vars here are in order to omit LANg and LC_ALL from envs

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
  errorBuffer: Buffer[]
  outputBuffer: Buffer[]
  waitForLogMatching(match: string, options?: { timeout?: number }): Promise<void>
  output: string
  error: string
  close(): Promise<void>
  promptHistory: any[]
}

type $FIXME = any

interface DevServerOptions {
  args?: string[]
  context?: string | null | undefined
  cwd: string
  framework?: string
  command?: string
  debug?: boolean
  env?: NodeJS.ProcessEnv | undefined
  expectFailure?: boolean
  offline?: boolean
  prompt?: $FIXME[]
  serve?: boolean
  skipWaitPort?: boolean
  targetPort?: number
}

// 240 seconds
const SERVER_START_TIMEOUT = 24e4

const startServer = async ({
  args = [],
  command,
  context = 'dev',
  cwd,
  debug = false,
  env = {},
  expectFailure = false,
  framework,
  offline = true,
  prompt,
  serve = false,
  skipWaitPort = false,
  targetPort,
}: DevServerOptions): Promise<DevServer | { timeout: boolean; output: string }> => {
  const port = await getPort()
  const host = 'localhost'
  const url = `http://${host}:${port}`

  console.log(`Starting dev server on port: ${port} in directory ${path.basename(cwd)}`)
  const baseCommand = serve ? 'serve' : 'dev'
  const baseArgs = [
    baseCommand,
    offline ? '--offline' : '',
    '-p',
    port.toString(),
    debug ? '--debug' : '',
    skipWaitPort ? '--skip-wait-port' : '',
  ]

  if (targetPort) {
    baseArgs.push('--target-port', targetPort.toString())
  } else {
    const staticPort = await getPort()
    baseArgs.push('--staticServerPort', staticPort.toString())
  }

  if (framework) {
    baseArgs.push('--framework', framework)
  }

  if (command) {
    baseArgs.push('--command', command)
  }

  // We use `null` to override the default context and actually omit the flag
  // from the command, which is useful in some test scenarios.
  if (context !== null) {
    baseArgs.push('--context', context)
  }

  const ps = execa(cliPath, [...baseArgs, ...args], getExecaOptions({ cwd, env }))

  if (process.env.DEBUG_TESTS) {
    ps.stderr!.pipe(process.stderr)
    ps.stdout!.pipe(process.stdout)
  }

  const promptHistory: any[] = []

  if (prompt) {
    handleQuestions(ps, prompt, promptHistory)
  }

  const outputBuffer: Buffer[] = []
  const errorBuffer: Buffer[] = []
  const serverPromise = new Promise<DevServer>((resolve, reject) => {
    let selfKilled = false
    ps.stderr!.on('data', (data: Buffer) => {
      errorBuffer.push(data)
    })
    ps.stdout!.on('data', (data: Buffer) => {
      outputBuffer.push(data)
      if (!expectFailure && data.includes('Local dev server ready')) {
        setImmediate(() => {
          resolve({
            url,
            host,
            port,
            errorBuffer,
            outputBuffer,
            waitForLogMatching(match: string, options?: { timeout?: number }) {
              const timeout = options?.timeout ?? 30_000
              return new Promise<void>((resolveWait, rejectWait) => {
                if (outputBuffer.join('').includes(match)) {
                  resolveWait()
                  return
                }

                const listener = (stdoutData: string) => {
                  if (stdoutData.includes(match)) {
                    clearTimeout(timeoutId)
                    ps.stdout!.removeListener('data', listener)
                    resolveWait()
                  }
                }

                const timeoutId = setTimeout(() => {
                  ps.stdout!.removeListener('data', listener)
                  rejectWait(new Error(`Timeout waiting for log matching "${match}" after ${timeout}ms`))
                }, timeout)

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
          })
        })
      }
    })
    ps.catch((error) => !selfKilled && reject(error))
  })

  return await pTimeout(serverPromise, {
    milliseconds: SERVER_START_TIMEOUT,
    fallback: () => ({ timeout: true, output: outputBuffer.join('') }),
  })
}

export const startDevServer = async (options: DevServerOptions, expectFailure?: boolean): Promise<DevServer> => {
  const maxAttempts = 5

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // do not use destruction, as we use getters which otherwise would be evaluated here
      const devServer = await startServer({ ...options, expectFailure })
      // @ts-expect-error TS(2339) FIXME: Property 'timeout' does not exist on type 'DevServ... Remove this comment to see the full error message
      if (devServer.timeout) {
        throw new Error(`Timed out starting dev server.\nServer Output:\n${devServer.output}`)
      }
      // @ts-expect-error TS(2322) FIXME: Type 'DevServer | { timeout: boolean; output: stri... Remove this comment to see the full error message
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

export const withDevServer = async <T>(
  options: DevServerOptions,
  testHandler: (server: DevServer) => Promise<T>,
  expectFailure = false,
): Promise<T> => {
  let server: DevServer | undefined
  try {
    server = await startDevServer(options, expectFailure)
    return await testHandler(server)
  } catch (err) {
    if (!(err instanceof Error)) {
      throw err
    }

    const error: Error & { stdout?: string | undefined; stderr?: string | undefined } = err
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

export const tryAndLogOutput = async (func: () => Promise<void>, outputBuffer: unknown[]) => {
  try {
    await func()
  } catch (error) {
    console.log(outputBuffer.join(''))
    throw error
  }
}
