import { dirname, join } from 'path'
import process, { version as nodejsVersion } from 'process'
import { fileURLToPath } from 'url'

import execa from '../execa.mjs'
import getGlobalConfig from '../get-global-config.mjs'

import { cliVersion } from './utils.mjs'

const dirPath = dirname(fileURLToPath(import.meta.url))

/**
 *
 * @param {import('@bugsnag/js').NotifiableError} error
 * @param {object} config
 * @param {import('@bugsnag/js').Event['severity']} config.severity
 * @returns {Promise<void>}
 */
export const reportError = async function (error, config = {}) {
  const globalConfig = await getGlobalConfig()

  const options = JSON.stringify({
    type: 'error',
    data: {
      message: error.message,
      name: error.name,
      stack: error.stack,
      cause: error.cause,
      severity: config.severity,
      user: {
        id: globalConfig.get('userId'),
      },
      osName: process.platform,
      cliVersion,
      nodejsVersion,
    },
  })

  // spawn detached child process to handle send
  execa(process.execPath, [join(dirPath, 'request.mjs'), options], {
    detached: true,
    stdio: 'ignore',
  }).unref()
}
