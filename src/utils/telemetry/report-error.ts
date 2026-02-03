import os from 'os'
import { dirname, join } from 'path'
import process, { version as nodejsVersion } from 'process'
import { fileURLToPath } from 'url'

import type { NotifiableError, Event } from '@bugsnag/js'
import { getGlobalConfigStore } from '@netlify/dev-utils'
import { isCI } from 'ci-info'

import execa from '../execa.js'

import { cliVersion } from './utils.js'

const dirPath = dirname(fileURLToPath(import.meta.url))

/**
 * Reports an error to telemetry.
 */
export const reportError = async function (
  error: NotifiableError | Record<string, unknown>,
  config: { severity: Event['severity']; metadata?: Record<string, unknown> } = { severity: 'error' },
) {
  if (isCI) {
    return
  }

  // convert a NotifiableError to an error class
  const err =
    error instanceof Error ? error : typeof error === 'string' ? new Error(error) : (error as Record<string, unknown>)

  const globalConfig = await getGlobalConfigStore()

  const options = JSON.stringify({
    type: 'error',
    data: {
      message: 'message' in err ? (err.message as string) : 'Unknown error',
      name: 'name' in err ? (err.name as string) : 'Error',
      stack: 'stack' in err ? (err.stack as string) : undefined,
      cause: 'cause' in err ? err.cause : undefined,
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
