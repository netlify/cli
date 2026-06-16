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
  'for a list of available commands',
]

const isUserInputError = (message: unknown): boolean =>
  typeof message === 'string' && USER_INPUT_ERROR_MESSAGE_PATTERNS.some((pattern) => message.includes(pattern))

// `Bugsnag.notify()` discards the `stack` property of plain objects and substitutes a
// stacktrace captured here, inside this function. Rebuilding a real Error and assigning
// the stack sent by the CLI preserves the original frames from the user's machine.
const toError = ({
  cause,
  message,
  name,
  stack,
}: {
  cause?: unknown
  message?: unknown
  name?: unknown
  stack?: unknown
}): Error => {
  const error = new Error(typeof message === 'string' ? message : String(message))
  if (typeof name === 'string' && name !== '') {
    error.name = name
  }
  if (typeof stack === 'string' && stack !== '') {
    error.stack = stack
  }
  if (cause !== undefined) {
    error.cause = cause
  }
  return error
}

// Stack frames arrive with machine-specific install prefixes, e.g.
// file:///C:/Users/jane/AppData/Roaming/npm/node_modules/netlify-cli/dist/utils/x.js.
// Stripping everything up to the last `node_modules` makes the same frame identical
// across machines and install layouts (npm, npx, pnpm) so Bugsnag groups on it.
const normalizeFrameFile = (file: string): string =>
  file.replace(/^.*node_modules[/\\]/, '').replace(/\\/g, '/')

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

    Bugsnag.notify(toError({ cause, message, name, stack }), (event) => {
      event.app = {
        releaseStage: 'production',
        version: cliVersion,
        type: 'netlify-cli',
      }

      for (const error of event.errors) {
        for (const frame of error.stacktrace) {
          if (typeof frame.file === 'string') {
            frame.file = normalizeFrameFile(frame.file)
            frame.inProject = frame.file.startsWith('netlify-cli/')
          }
        }
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
