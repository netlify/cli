// @ts-check
import waitPort from 'wait-port'

import { startSpinner, stopSpinner } from '../lib/spinner.mjs'

import { error, exit, log, NETLIFYDEVERR, NETLIFYDEVLOG } from './command-helpers.mjs'
import { runCommand } from './shell.mjs'
import { startStaticServer } from './static-server.mjs'

// 10 minutes
const FRAMEWORK_PORT_TIMEOUT = 6e5

/**
 * @typedef StartReturnObject
 * @property {4 | 6 | undefined=} ipVersion The version the open port was found on
 */

/**
 * Start a static server if the `useStaticServer` is provided or a framework specific server
 * @param {object} config
 * @param {Partial<import('./types').ServerSettings>} config.settings
 * @returns {Promise<StartReturnObject>}
 */
export const startFrameworkServer = async function ({ settings }) {
  if (settings.useStaticServer) {
    if (settings.command) {
      runCommand(settings.command, settings.env)
    }
    await startStaticServer({ settings })

    return {}
  }

  log(`${NETLIFYDEVLOG} Starting Netlify Dev with ${settings.framework || 'custom config'}`)

  const spinner = startSpinner({
    text: `Waiting for framework port ${settings.frameworkPort}. This can be configured using the 'targetPort' property in the netlify.toml`,
  })

  runCommand(settings.command, settings.env, spinner)

  let port
  try {
    port = await waitPort({
      port: settings.frameworkPort,
      host: 'localhost',
      output: 'silent',
      timeout: FRAMEWORK_PORT_TIMEOUT,
      ...(settings.pollingStrategies.includes('HTTP') && { protocol: 'http' }),
    })

    if (!port.open) {
      throw new Error(`Timed out waiting for port '${settings.frameworkPort}' to be open`)
    }

    stopSpinner({ error: false, spinner })
  } catch (error_) {
    stopSpinner({ error: true, spinner })
    log(NETLIFYDEVERR, `Netlify Dev could not start or connect to localhost:${settings.frameworkPort}.`)
    log(NETLIFYDEVERR, `Please make sure your framework server is running on port ${settings.frameworkPort}`)
    error(error_)
    exit(1)
  }

  return { ipVersion: port?.ipVersion }
}
