// @ts-check
import fs from 'fs'
import { createRequire } from 'module'
import path from 'path'
import process from 'process'

import inquirer from 'inquirer'
import fetch from 'node-fetch'

import { NETLIFYDEVWARN, chalk, error, exit } from '../../utils/command-helpers.mjs'
import { BACKGROUND, CLOCKWORK_USERAGENT, getFunctions } from '../../utils/functions/index.mjs'

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

// https://stackoverflow.com/questions/3710204/how-to-check-if-a-string-is-a-valid-json-string-in-javascript-without-using-try
const tryParseJSON = function (jsonString) {
  try {
    const parsedValue = JSON.parse(jsonString)

    // Handle non-exception-throwing cases:
    // Neither JSON.parse(false) or JSON.parse(1234) throw errors, hence the type-checking,
    // but... JSON.parse(null) returns null, and typeof null === "object",
    // so we must check for that, too. Thankfully, null is falsey, so this suffices:
    if (parsedValue && typeof parsedValue === 'object') {
      return parsedValue
    }
  } catch {}

  return false
}

const formatQstring = function (querystring) {
  if (querystring) {
    return `?${querystring}`
  }
  return ''
}

/** process payloads from flag */
const processPayloadFromFlag = function (payloadString) {
  if (payloadString) {
    // case 1: jsonstring
    let payload = tryParseJSON(payloadString)
    if (payload) return payload
    // case 2: jsonpath
    const payloadpath = path.join(process.cwd(), payloadString)
    const pathexists = fs.existsSync(payloadpath)
    if (pathexists) {
      try {
        // there is code execution potential here
        // eslint-disable-next-line import/no-dynamic-require
        payload = require(payloadpath)
        return payload
      } catch (error_) {
        console.error(error_)
      }
    }
    // case 3: invalid string, invalid path
    return false
  }
}

/**
 * prompt for a name if name not supplied
 *  also used in functions:create
 * @param {*} functions
 * @param {import('commander').OptionValues} options
 * @param {string} [argumentName] The name that might be provided as argument (optional argument)
 * @returns {Promise<string>}
 */
const getNameFromArgs = async function (functions, options, argumentName) {
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

  const { trigger } = await inquirer.prompt([
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
 * @param {import('commander').OptionValues} options
 * @param {string} [argumentName] The name that might be provided as argument (optional argument)
 * @returns {string}
 */
const getFunctionToTrigger = function (options, argumentName) {
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
 * The functions:invoke command
 * @param {string} nameArgument
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
const functionsInvoke = async (nameArgument, options, command) => {
  const { config } = command.netlify

  const functionsDir = options.functions || (config.dev && config.dev.functions) || config.functionsDirectory
  if (typeof functionsDir === 'undefined') {
    error('functions directory is undefined, did you forget to set it in netlify.toml?')
  }

  if (!options.port)
    console.warn(`${NETLIFYDEVWARN} "port" flag was not specified. Attempting to connect to localhost:8888 by default`)
  const port = options.port || DEFAULT_PORT

  const functions = await getFunctions(functionsDir, config)
  const functionToTrigger = await getNameFromArgs(functions, options, nameArgument)
  const functionObj = functions.find((func) => func.name === functionToTrigger)

  let headers = {}
  let body = {}

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
  const payload = processPayloadFromFlag(options.payload)
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
    error(`Ran into an error invoking your function: ${error_.message}`)
  }
}

/**
 * Creates the `netlify functions:invoke` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createFunctionsInvokeCommand = (program) =>
  program
    .command('functions:invoke')
    .alias('function:trigger')
    .argument('[name]', 'function name to invoke')
    .description(
      `Trigger a function while in netlify dev with simulated data, good for testing function calls including Netlify's Event Triggered Functions`,
    )
    .option('-n, --name <name>', 'function name to invoke')
    .option('-f, --functions <dir>', 'Specify a functions folder to parse, overriding netlify.toml')
    .option('-q, --querystring <query>', 'Querystring to add to your function invocation')
    .option('-p, --payload <data>', 'Supply POST payload in stringified json, or a path to a json file')
    // TODO: refactor to not need the `undefined` state by removing the --identity flag (value `identity` will be then always defined to true or false)
    .option(
      '--identity',
      'simulate Netlify Identity authentication JWT. pass --identity to affirm unauthenticated request',
    )
    .option(
      '--no-identity',
      'simulate Netlify Identity authentication JWT. pass --no-identity to affirm unauthenticated request',
    )
    .option('--port <port>', 'Port where netlify dev is accessible. e.g. 8888', (value) => Number.parseInt(value))
    .addExamples([
      'netlify functions:invoke',
      'netlify functions:invoke myfunction',
      'netlify functions:invoke --name myfunction',
      'netlify functions:invoke --name myfunction --identity',
      'netlify functions:invoke --name myfunction --no-identity',
      `netlify functions:invoke myfunction --payload '{"foo": 1}'`,
      'netlify functions:invoke myfunction --querystring "foo=1',
      'netlify functions:invoke myfunction --payload "./pathTo.json"',
    ])
    .action(functionsInvoke)
