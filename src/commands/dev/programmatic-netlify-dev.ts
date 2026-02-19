import process from 'process'

import { NetlifyDev } from '@netlify/dev'

import { NETLIFYDEVWARN, log } from '../../utils/command-helpers.js'
import type { EnvironmentVariables } from '../../utils/types.js'

interface StartNetlifyDevOptions {
  projectRoot: string
  apiToken: string | undefined
  env: EnvironmentVariables
}

/**
 * Much of the core of local dev emulation of the Netlify platform was extracted
 * (duplicated) to https://github.com/netlify/primitives. This is a shim that
 * gradually enables *some* of this extracted functionality while falling back
 * to the legacy copy in this codebase for the rest.
 *
 * TODO: Hook this up to the request chain and fall through to the existing handler.
 * TODO: `@netlify/images` follows a different pattern (it is used directly).
 * Move that here.
 */
export const startNetlifyDev = async ({
  apiToken,
  env,
  projectRoot,
}: StartNetlifyDevOptions): Promise<NetlifyDev | undefined> => {
  if (process.env.EXPERIMENTAL_NETLIFY_DB_ENABLED !== '1') {
    return
  }

  const netlifyDev = new NetlifyDev({
    projectRoot,
    apiToken,
    ...(process.env.NETLIFY_API_URL && { apiURL: process.env.NETLIFY_API_URL }),

    aiGateway: { enabled: false },
    blobs: { enabled: false },
    edgeFunctions: { enabled: false },
    environmentVariables: { enabled: false },
    functions: { enabled: false },
    geolocation: { enabled: false },
    headers: { enabled: false },
    images: { enabled: false },
    redirects: { enabled: false },
    staticFiles: { enabled: false },
    serverAddress: null,
  })

  try {
    await netlifyDev.start()
  } catch (error) {
    log(`${NETLIFYDEVWARN} Failed to start @netlify/dev: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (process.env.NETLIFY_DB_URL) {
    env.NETLIFY_DB_URL = { sources: ['internal'], value: process.env.NETLIFY_DB_URL }
  }

  return netlifyDev
}
