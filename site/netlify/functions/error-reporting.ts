import process from 'process'

import Bugsnag from '@bugsnag/js'
import type { Handler } from '@netlify/functions'

Bugsnag.start({
  apiKey: `${process.env.NETLIFY_BUGSNAG_API_KEY}`,
})

export const handler: Handler = async ({ body }) => {
  try {
    if (typeof body !== 'string') {
      return { statusCode: 200 }
    }
    const {
      cause,
      cliVersion,
      message,
      metadata = {},
      name,
      nodejsVersion,
      osName,
      severity = 'error',
      stack,
      user,
    } = JSON.parse(body)
    Bugsnag.notify({ name, message, stack, cause }, (event) => {
      event.app = {
        releaseStage: 'production',
        version: cliVersion,
        type: 'netlify-cli',
      }

      for (const [section, values] of Object.entries(metadata)) {
        event.addMetadata(section, values as Record<string, any>)
      }
      event.setUser(user.id, user.email, user.name)
      event.severity = severity
      event.device = {
        osName,
        runtimeVersions: {
          node: nodejsVersion,
        },
      }
    })
  } catch (error) {
    Bugsnag.notify(error)
  }
  return {
    statusCode: 200,
  }
}
