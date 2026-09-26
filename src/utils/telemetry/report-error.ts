import os from 'os'
import { dirname, join } from 'path'
import process, { version as nodejsVersion } from 'process'
import { fileURLToPath } from 'url'
import { inspect } from 'util'

import { getGlobalConfigStore } from '@netlify/dev-utils'
import { isCI } from 'ci-info'

import { isNetlifyConfigUserError } from '../errors.js'
import execa from '../execa.js'

import { cliVersion } from './utils.js'

const dirPath = dirname(fileURLToPath(import.meta.url))

let currentCommand: string | undefined

export const setCommandForErrorReporting = (command?: string): void => {
  currentCommand = command
}

export interface ErrorReportConfig {
  severity?: 'info' | 'warning' | 'error'
  metadata?: Record<string, Record<string, unknown>>
}

export const reportError = async function (error: unknown, config: ErrorReportConfig = {}): Promise<void> {
  if (isCI) {
    return
  }

  const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : inspect(error))

  // These are user errors, not CLI bugs, and don't belong in Bugsnag.
  if (isNetlifyConfigUserError(error)) {
    return
  }

  const globalConfig = await getGlobalConfigStore()

  const options = JSON.stringify({
    type: 'error',
    data: {
      message: err.message,
      name: err.name,
      stack: err.stack,
      cause: err.cause,
      severity: config.severity,
      user: {
        id: globalConfig.get('userId'),
      },
      metadata: {
        ...config.metadata,
        ...(currentCommand === undefined ? {} : { command: { name: currentCommand } }),
      },
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
