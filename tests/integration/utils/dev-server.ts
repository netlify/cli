import { readdir, readFile } from 'node:fs/promises'
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

  // Diagnostics for the Node 24 serve-mode hang. The trace flags surface any
  // uncaught exception, deprecation warning, or process.exit. --report-on-signal
  // makes Node emit a full diagnostic report (stacks + libuv handles) on SIGUSR2,
  // written to a file in cwd. The test util sends SIGUSR2 just before the
  // start-timeout fires so the report captures *what* the process is stuck on.
  // Note: --report-on-fatalerror, --report-uncaught-exception, and
  // --report-filename are NOT permitted in NODE_OPTIONS (Worker threads reject
  // env vars containing them), so we keep this list to the allowed subset.
  const traceFlags = '--trace-warnings --trace-uncaught --trace-exit --report-on-signal --report-signal=SIGUSR2'
  const nodeOptions = baseEnv.NODE_OPTIONS ? `${baseEnv.NODE_OPTIONS} ${traceFlags}` : traceFlags

  return {
    cwd,
    extendEnv: false,
    env: { ...baseEnv, BROWSER: 'none', NODE_OPTIONS: nodeOptions, ...env },
    encoding: 'utf8',
  }
}

export interface DevServer {
  url: string
  host: string
  port: number
  errorBuffer: Buffer[]
  outputBuffer: Buffer[]
  waitForLogMatching(match: string, timeoutMs?: number): Promise<void>
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

// 60 seconds. Kept under vitest's 90-second per-test default so the fallback below
// fires (and dumps the captured server output) before vitest kills the test for timing out.
const SERVER_START_TIMEOUT = 6e4

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
            waitForLogMatching(match: string, timeoutMs = 30_000) {
              return pTimeout(
                new Promise<void>((resolveWait) => {
                  const listener = (stdoutData: string) => {
                    if (stdoutData.includes(match)) {
                      ps.stdout!.removeListener('data', listener)
                      resolveWait()
                    }
                  }
                  ps.stdout!.on('data', listener)
                }),
                {
                  milliseconds: timeoutMs,
                  message: `Timed out waiting for log matching "${match}".\nOutput so far:\n${outputBuffer.join('')}`,
                },
              )
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
    // The subprocess can exit cleanly (code 0) without ever emitting
    // "Local dev server ready" — when that happens the promise above would hang until
    // SERVER_START_TIMEOUT. Detect both clean and error exits and reject with the
    // captured output so the failure is visible immediately.
    ps.then(
      (result) => {
        if (!selfKilled) {
          reject(
            new Error(
              `Dev server subprocess exited (code=${result.exitCode}) before "Local dev server ready" was emitted.\nstdout:\n${outputBuffer.join('')}\nstderr:\n${errorBuffer.join('')}`,
            ),
          )
        }
      },
      (error: unknown) => {
        if (!selfKilled) {
          reject(error instanceof Error ? error : new Error(String(error)))
        }
      },
    )
  })

  return await pTimeout(serverPromise, {
    milliseconds: SERVER_START_TIMEOUT,
    fallback: async () => {
      // Ask the (presumed-hung) subprocess to write a Node diagnostic report
      // (stack traces + libuv handle state — i.e. *what* the process is stuck on).
      // The report is written to a file in the subprocess's cwd; we read it
      // back below.
      let diagnosticReport = ''
      if (ps.pid != null && !ps.killed) {
        try {
          process.kill(ps.pid, 'SIGUSR2')
          await new Promise((resolve) => setTimeout(resolve, 2_000))
          const entries = await readdir(cwd)
          const reports = entries
            .filter((name) => name.startsWith('report.') && name.endsWith('.json'))
            .sort()
          if (reports.length > 0) {
            const last = reports[reports.length - 1]
            diagnosticReport = await readFile(path.join(cwd, last), 'utf8')
          }
        } catch {
          // process may have already exited, or the report write may have failed —
          // either way we want to fall through and surface what we have
        }
      }
      return {
        timeout: true,
        output: outputBuffer.join(''),
        error: errorBuffer.join(''),
        report: diagnosticReport,
      }
    },
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
        throw new Error(
          // @ts-expect-error TS(2339) FIXME: Property 'output'/'error'/'report' does not exist...
          `Timed out starting dev server.\nServer Output:\n${devServer.output}\nServer Error:\n${devServer.error ?? ''}\nDiagnostic Report:\n${devServer.report ?? '(none captured)'}`,
        )
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
