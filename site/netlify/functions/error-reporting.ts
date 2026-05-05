import process from 'process'

import Bugsnag from '@bugsnag/js'
import type { Handler } from '@netlify/functions'

Bugsnag.start({
  apiKey: `${process.env.NETLIFY_BUGSNAG_API_KEY}`,
})

const USER_INPUT_ERROR_MESSAGE_PATTERNS: string[] = [
  'When resolving config file',
  'NETLIFY_AUTH_TOKEN is not set',
  'Project not found. Please rerun',
  'Not authorized to view the currently linked project',
  'could not retrieve project',
  "You don't appear to be in a folder that is linked to a project",
  'EADDRINUSE: address already in use',
]

const isUserInputError = (message: unknown): boolean =>
  typeof message === 'string' && USER_INPUT_ERROR_MESSAGE_PATTERNS.some((pattern) => message.includes(pattern))

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

    if (isUserInputError(message)) {
      return { statusCode: 200 }
    }

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
