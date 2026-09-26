import fs from 'fs'
import { createRequire } from 'module'
import path from 'path'

import type { OptionValues } from 'commander'
import inquirer from 'inquirer'
import fetch from 'node-fetch'

import { NETLIFYDEVWARN, chalk, logAndThrowError, exit } from '../../utils/command-helpers.js'
import { BACKGROUND, CLOCKWORK_USERAGENT, type LocalFunction, getFunctions } from '../../utils/functions/index.js'
import type BaseCommand from '../base-command.js'

const require = createRequire(import.meta.url)

interface FunctionsInvokeOptions extends OptionValues {
  name?: string
  functions?: string
  querystring?: string
  payload?: string
  identity?: boolean
  port?: number
}

// https://docs.netlify.com/functions/trigger-on-events/
const events = [
  'deploy-building',
  'deploy-succeeded',
  'deploy-failed',
  'deploy-locked',
  'deploy-unlocked',
  'split-test-activated',
  'split-test-deactivated',
  'split-test-modified',
  'submission-created',
  'identity-validate',
  'identity-signup',
  'identity-login',
]

const eventTriggeredFunctions = new Set([...events, ...events.map((name) => `${name}${BACKGROUND}`)])

const DEFAULT_PORT = 8888

const isObject = (value: unknown): value is object => typeof value === 'object' && value !== null

const tryParseJSON = function (jsonString: string): object | undefined {
  try {
    const parsedValue: unknown = JSON.parse(jsonString)

    // Neither JSON.parse(false) or JSON.parse(1234) throw errors, so only accept objects
    if (isObject(parsedValue)) {
      return parsedValue
    }
  } catch {
    // Not a JSON string
  }
  return undefined
}

const formatQstring = function (querystring: string | undefined) {
  if (querystring) {
    return `?${querystring}`
  }
  return ''
}

const processPayloadFromFlag = function (payloadString: string | undefined, workingDir: string): object | undefined {
  if (!payloadString) {
    return
  }

  // case 1: jsonstring
  const parsedPayload = tryParseJSON(payloadString)
  if (parsedPayload) return parsedPayload

  // case 2: jsonpath
  const payloadpath = path.join(workingDir, payloadString)
  if (fs.existsSync(payloadpath)) {
    try {
      // there is code execution potential here
      const payload: unknown = require(payloadpath)
      if (isObject(payload)) return payload
    } catch (error_) {
      console.error(error_)
    }
  }
  return undefined
}

/**
 * get the function name out of the argument or options
 */
const getFunctionToTrigger = function (options: FunctionsInvokeOptions, argumentName: string | undefined) {
  if (options.name) {
    if (argumentName) {
      console.error('function name specified in both flag and arg format, pick one')
      exit(1)
    }

    return options.name
  }

  return argumentName
}

/**
 * prompt for a function if a valid name was not supplied
 */
const pickFunction = async function (
  functions: LocalFunction[],
  options: FunctionsInvokeOptions,
  argumentName: string | undefined,
): Promise<LocalFunction> {
  const functionToTrigger = getFunctionToTrigger(options, argumentName)

  if (functionToTrigger) {
    const matchingFunction = functions.find(({ name }) => name === functionToTrigger)
    if (matchingFunction) {
      return matchingFunction
    }

    console.warn(
      `Function name ${chalk.yellow(
        functionToTrigger,
      )} supplied but no matching function found in your functions folder, forcing you to pick a valid one...`,
    )
  }

  const { trigger } = await inquirer.prompt<{ trigger: LocalFunction }>([
    {
      type: 'list',
      message: 'Pick a function to trigger',
      name: 'trigger',
      choices: functions.map((func) => ({ name: func.name, value: func })),
    },
  ])
  return trigger
}

export const functionsInvoke = async (
  nameArgument: string | undefined,
  options: FunctionsInvokeOptions,
  command: BaseCommand,
) => {
  const { config, relConfigFilePath } = command.netlify

  const functionsDir = options.functions || config.dev?.functions || config.functionsDirectory
  if (typeof functionsDir === 'undefined') {
    return logAndThrowError(`Functions directory is undefined, did you forget to set it in ${relConfigFilePath}?`)
  }

  if (!options.port)
    console.warn(`${NETLIFYDEVWARN} "port" flag was not specified. Attempting to connect to localhost:8888 by default`)
  const port = options.port || DEFAULT_PORT

  const functions = await getFunctions(functionsDir, config)
  if (functions.length === 0) {
    return logAndThrowError(`No functions found in ${functionsDir}`)
  }
  const functionToTrigger = await pickFunction(functions, options, nameArgument)

  let headers: Record<string, string> = {}
  let body: Record<string, unknown> = {}

  if (functionToTrigger.schedule) {
    headers = {
      'user-agent': CLOCKWORK_USERAGENT,
    }
  } else if (eventTriggeredFunctions.has(functionToTrigger.name)) {
    /** handle event triggered fns  */
    // https://docs.netlify.com/functions/trigger-on-events/
    const [name, event] = functionToTrigger.name.split('-')
    if (name === 'identity') {
      // https://docs.netlify.com/functions/functions-and-identity/#trigger-functions-on-identity-events
      body.event = event
      body.user = {
        id: '1111a1a1-a11a-1111-aa11-aaa11111a11a',
        aud: '',
        role: '',
        email: 'foo@trust-this-company.com',
        app_metadata: {
          provider: 'email',
        },
        user_metadata: {
          full_name: 'Test Person',
        },
        created_at: new Date(Date.now()).toISOString(),
        update_at: new Date(Date.now()).toISOString(),
      }
    } else {
      // non identity functions seem to have a different shape
      // https://docs.netlify.com/functions/trigger-on-events/#payload
      body.payload = {
        TODO: 'mock up payload data better',
      }
      body.site = {
        TODO: 'mock up site data better',
      }
    }
  } else {
    // NOT an event triggered function, but may still want to simulate authentication locally
    const isAuthenticated = Boolean(options.identity)

    if (isAuthenticated) {
      headers = {
        authorization:
          'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzb3VyY2UiOiJuZXRsaWZ5IGZ1bmN0aW9uczp0cmlnZ2VyIiwidGVzdERhdGEiOiJORVRMSUZZX0RFVl9MT0NBTExZX0VNVUxBVEVEX0pXVCJ9.Xb6vOFrfLUZmyUkXBbCvU4bM7q8tPilF0F03Wupap_c',
      }
      // you can decode this https://jwt.io/
      // {
      //   "source": "netlify functions:trigger",
      //   "testData": "NETLIFY_DEV_LOCALLY_EMULATED_JWT"
      // }
    }
  }
  const payload = processPayloadFromFlag(options.payload, command.workingDir)
  body = { ...body, ...payload }

  try {
    const response = await fetch(
      `http://localhost:${port.toString()}/.netlify/functions/${functionToTrigger.name}${formatQstring(
        options.querystring,
      )}`,
      {
        method: 'post',
        headers,
        body: JSON.stringify(body),
      },
    )
    const data = await response.text()
    console.log(data)
  } catch (error_) {
    return logAndThrowError(`Ran into an error invoking your function: ${(error_ as Error).message}`)
  }
}
