import os from 'os'
import { dirname, join } from 'path'
import process, { version as nodejsVersion } from 'process'
import { fileURLToPath } from 'url'

import { type Event } from '@bugsnag/js'
import { getGlobalConfigStore } from '@netlify/dev-utils'
import { isCI } from 'ci-info'

import execa from '../execa.js'

import { cliVersion } from './utils.js'

const dirPath = dirname(fileURLToPath(import.meta.url))

interface ReportErrorConfig {
  severity?: Event['severity']
  metadata?: Record<string, Record<string, unknown>>
}

/**
 * Report an error to telemetry
 */
export const reportError = async function (error: unknown, config: ReportErrorConfig = {}): Promise<void> {
  if (isCI) {
    return
  }

  // convert a NotifiableError to an error class
  let err: Error
  if (error instanceof Error) {
    err = error
  } else if (typeof error === 'string') {
    err = new Error(error)
  } else if (typeof error === 'object' && error !== null && ('message' in error || 'name' in error)) {
    const errorObject = error as Record<string, unknown>
    const message = typeof errorObject.message === 'string' ? errorObject.message : 'Unknown error'
    err = new Error(message)
    if (typeof errorObject.name === 'string') {
      err.name = errorObject.name
    }
    if (typeof errorObject.stack === 'string') {
      err.stack = errorObject.stack
    }
  } else {
    err = new Error(typeof error === 'object' && error !== null ? JSON.stringify(error) : String(error))
  }

  const globalConfig = await getGlobalConfigStore()

  const options = JSON.stringify({
    type: 'error',
    data: {
      message: err.message,
      name: err.name,
      stack: err.stack,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cause: (err as any).cause,
      severity: config.severity,
      user: {
        id: globalConfig.get('userId'),
      },
      metadata: config.metadata,
      osName: `${os.platform()}-${os.arch()}`,
      cliVersion,
      nodejsVersion,
    },
  })

  // spawn detached child process to handle send and wait for the http request to finish
  // otherwise it can get canceled
  await execa(process.execPath, [join(dirPath, 'request.js'), options], {
    detached: true,
    stdio: 'ignore',
  })
}
