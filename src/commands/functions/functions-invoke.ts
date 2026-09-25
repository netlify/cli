import fs from 'fs'
import { createRequire } from 'module'
import path from 'path'

import inquirer from 'inquirer'
import fetch from 'node-fetch'

import { NETLIFYDEVWARN, chalk, logAndThrowError, exit } from '../../utils/command-helpers.js'
import { BACKGROUND, CLOCKWORK_USERAGENT, type LocalFunction, getFunctions } from '../../utils/functions/index.js'
import type BaseCommand from '../base-command.js'
import type { FunctionsInvokeOptionValues } from './option_values.js'

const require = createRequire(import.meta.url)

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
 * prompt for a name if name not supplied
 *  also used in functions:create
 */
const getNameFromArgs = async function (
  functions: LocalFunction[],
  options: FunctionsInvokeOptionValues,
  argumentName: string | undefined,
): Promise<string> {
  const functionToTrigger = getFunctionToTrigger(options, argumentName)
  const functionNames = functions.map(({ name }) => name)

  if (functionToTrigger) {
    if (functionNames.includes(functionToTrigger)) {
      return functionToTrigger
    }

    console.warn(
      `Function name ${chalk.yellow(
        functionToTrigger,
      )} supplied but no matching function found in your functions folder, forcing you to pick a valid one...`,
    )
  }

  const { trigger } = await inquirer.prompt<{ trigger: string }>([
    {
      type: 'list',
      message: 'Pick a function to trigger',
      name: 'trigger',
      choices: functionNames,
    },
  ])
  return trigger
}

/**
 * get the function name out of the argument or options
 */
const getFunctionToTrigger = function (options: FunctionsInvokeOptionValues, argumentName: string | undefined) {
  if (options.name) {
    if (argumentName) {
      console.error('function name specified in both flag and arg format, pick one')
      exit(1)
    }

    return options.name
  }

  return argumentName
}

export const functionsInvoke = async (
  nameArgument: string | undefined,
  options: FunctionsInvokeOptionValues,
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
  const functionToTrigger = await getNameFromArgs(functions, options, nameArgument)
  const functionObj = functions.find((func) => func.name === functionToTrigger)

  let headers: Record<string, string> = {}
  let body: Record<string, unknown> = {}

  // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
  if (functionObj.schedule) {
    headers = {
      'user-agent': CLOCKWORK_USERAGENT,
    }
  } else if (eventTriggeredFunctions.has(functionToTrigger)) {
    /** handle event triggered fns  */
    // https://docs.netlify.com/functions/trigger-on-events/
    const [name, event] = functionToTrigger.split('-')
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
      `http://localhost:${port}/.netlify/functions/${functionToTrigger}${formatQstring(options.querystring)}`,
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
