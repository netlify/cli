import { rm } from 'node:fs/promises'

import waitPort from 'wait-port'

import { runCommand } from './shell.js'
import { startStaticServer } from './static-server.js'
import { ServerSettings } from './types.js'
import { NetlifyLog, spinner } from './styles/index.js'

// 10 minutes
const FRAMEWORK_PORT_TIMEOUT = 6e5

interface StartReturnObject {
  ipVersion?: 4 | 6
}

/**
 * Start a static server if the `useStaticServer` is provided or a framework specific server
 */
export const startFrameworkServer = async function ({
  cwd,
  settings,
}: {
  cwd: string
  settings: ServerSettings
}): Promise<StartReturnObject> {
  if (settings.useStaticServer) {
    if (settings.command) {
      runCommand(settings.command, { env: settings.env, cwd })
    }
    await startStaticServer({ settings })

    return {}
  }

  NetlifyLog.info(`Starting Netlify Dev with ${settings.framework || 'custom config'}`)

  const loading = spinner()
  loading.start(
    `Waiting for framework port ${settings.frameworkPort}. This can be configured using the 'targetPort' property in the netlify.toml`,
  )

  if (settings.clearPublishDirectory && settings.dist) {
    await rm(settings.dist, { recursive: true, force: true })
  }

  runCommand(settings.command, { env: settings.env, spinner, cwd })

  let port
  try {
    port = await waitPort({
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      port: settings.frameworkPort!,
      host: 'localhost',
      output: 'silent',
      timeout: FRAMEWORK_PORT_TIMEOUT,
      ...(settings.pollingStrategies?.includes('HTTP') && { protocol: 'http' }),
    })

    if (!port.open) {
      throw new Error(`Timed out waiting for port '${settings.frameworkPort}' to be open`)
    }

    loading.stop()
  } catch (error_) {
    NetlifyLog.error(`Netlify Dev could not start or connect to localhost:${settings.frameworkPort}.`)
    loading.stop('Please make sure your framework server is running on port ${settings.frameworkPort}', 1)
  }

  return { ipVersion: port?.ipVersion }
}
