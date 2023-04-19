import process from 'process'

import Bugsnag from '@bugsnag/js'
import { Handler } from '@netlify/functions'

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
      name,
      nodejsVersion,
      osName,
      severity = 'error',
      stack,
      user,
    } = JSON.parse(body)
    Bugsnag.notify({ name, message, stack, cause }, (event) => {
      event.setUser(user.id, user.email, user.name)
      event.severity = severity
      event.device = {
        osName,
        runtimeVersions: {
          nodejs: nodejsVersion,
          cli: cliVersion,
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
