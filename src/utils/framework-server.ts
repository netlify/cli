import { rm } from 'node:fs/promises'
import net from 'net'

import waitPort from 'wait-port'

import { startSpinner, stopSpinner } from '../lib/spinner.js'

// Custom port checker that handles ECONNRESET errors in Node.js 24.x
const checkPortWithRetry = async (
  port: number,
  host: string,
  timeout: number,
  maxRetries = 10,
): Promise<{ open: boolean; ipVersion?: 4 | 6 }> => {
  const startTime = Date.now()
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (Date.now() - startTime > timeout) {
      return { open: false }
    }
    
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = new net.Socket()
        let isResolved = false
        
        const cleanup = () => {
          if (!isResolved) {
            socket.destroy()
          }
        }
        
        socket.on('connect', () => {
          isResolved = true
          socket.end()
          resolve()
        })
        
        socket.on('error', (error) => {
          isResolved = true
          cleanup()
          // Silently retry on ECONNRESET (common in Node.js 24.x)
          if ('code' in error && error.code === 'ECONNRESET') {
            resolve() // Treat as "need to retry"
          } else {
            reject(error)
          }
        })
        
        socket.setTimeout(1000, () => {
          isResolved = true
          cleanup()
          reject(new Error('Socket timeout'))
        })
        
        socket.connect(port, host)
      })
      
      // Successfully connected
      return { open: true, ipVersion: net.isIPv6(host) ? 6 : 4 }
    } catch (error) {
      // Wait a bit before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.min(100 * (attempt + 1), 1000)))
      continue
    }
  }
  
  return { open: false }
}

import { logAndThrowError, log, NETLIFYDEVERR, NETLIFYDEVLOG, chalk } from './command-helpers.js'
import { runCommand } from './shell.js'
import { startStaticServer } from './static-server.js'
import type { ServerSettings } from './types.js'

const FRAMEWORK_PORT_TIMEOUT_MS = 10 * 60 * 1000
const FRAMEWORK_PORT_WARN_TIMEOUT_MS = 5 * 1000

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
    const { family } = await startStaticServer({ settings })
    return { ipVersion: family === 'IPv6' ? 6 : 4 }
  }

  log('')
  log(`${NETLIFYDEVLOG} Starting ${settings.framework || 'framework'} dev server`)

  const spinner = startSpinner({
    text: `Waiting for ${settings.framework || 'framework'} dev server to be ready on port ${settings.frameworkPort}`,
  })

  if (settings.clearPublishDirectory && settings.dist) {
    await rm(settings.dist, { recursive: true, force: true })
  }

  if (settings.command) {
    runCommand(settings.command, { env: settings.env, spinner, cwd })
  }

  let port: { open: boolean; ipVersion?: 4 | 6 } | undefined
  try {
    if (settings.skipWaitPort) {
      // default ip version based on node version
      const ipVersion = parseInt(process.versions.node.split('.')[0]) >= 18 ? 6 : 4
      port = { open: true, ipVersion }
    } else {
      const waitPortPromise = checkPortWithRetry(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        settings.frameworkPort!,
        'localhost',
        FRAMEWORK_PORT_TIMEOUT_MS,
        20,
      )

      const timerId = setTimeout(() => {
        if (!port?.open) {
          spinner.update({
            text: `Still waiting for server on port ${
              settings.frameworkPort
            } to be ready. Are you sure this is the correct port${
              settings.framework ? ` for ${settings.framework}` : ''
            }? Change this with the ${chalk.yellow('targetPort')} option in your ${chalk.yellow('netlify.toml')}.`,
          })
        }
      }, FRAMEWORK_PORT_WARN_TIMEOUT_MS)

      port = await waitPortPromise
      clearTimeout(timerId)

      if (!port.open) {
        throw new Error(`Timed out waiting for port '${settings.frameworkPort}' to be open`)
      }
    }
    spinner.success(`${settings.framework || 'framework'} dev server ready on port ${settings.frameworkPort}`)
  } catch (error_) {
    stopSpinner({ error: true, spinner })
    log(NETLIFYDEVERR, `Netlify Dev could not start or connect to localhost:${settings.frameworkPort}.`)
    log(NETLIFYDEVERR, `Please make sure your framework server is running on port ${settings.frameworkPort}`)
    log(
      NETLIFYDEVERR,
      `If not, you can configure it using the ${chalk.yellow('targetPort')} option in your ${chalk.yellow(
        'netlify.toml',
      )}.`,
    )
    return logAndThrowError(error_)
  }

  return { ipVersion: port.ipVersion }
}
