import { env } from 'process'

import { getURL } from '@netlify/edge-functions/version'

import { isNodeError, warn } from '../../utils/command-helpers.js'

export const getBootstrapURL = async () => {
  if (env.NETLIFY_EDGE_BOOTSTRAP) {
    return env.NETLIFY_EDGE_BOOTSTRAP
  }

  try {
    return await getURL()
  } catch (error) {
    if (isNodeError(error)) {
      warn(error.message)
    }

    // If there was an error getting the bootstrap URL from the module, let's
    // use the latest version of the bootstrap. This is not ideal, but better
    // than failing to serve requests with edge functions.
    return 'https://edge.netlify.com/bootstrap/index-combined.ts'
  }
}
