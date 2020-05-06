const chalk = require('chalk')
const Command = require('../../utils/command')
const { flags } = require('@oclif/command')
const inquirer = require('inquirer')
const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')

const { NETLIFYDEVWARN } = require('../../utils/logo')
const { getFunctions } = require('../../utils/get-functions')

// https://www.netlify.com/docs/functions/#event-triggered-functions
const eventTriggeredFunctions = [
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
  'identity-login'
]
class FunctionsInvokeCommand extends Command {
  async run() {
    let { flags, args } = this.parse(FunctionsInvokeCommand)
    const { config } = this.netlify

    const functionsDir = flags.functions || (config.dev && config.dev.functions) || (config.build && config.build.functions)
    if (typeof functionsDir === 'undefined') {
      this.error('functions directory is undefined, did you forget to set it in netlify.toml?')
      process.exit(1)
    }

    if (!flags.port) console.warn(`${NETLIFYDEVWARN} "port" flag was not specified. Attempting to connect to localhost:8888 by default`)
    const port = flags.port || 8888

    const functions = getFunctions(functionsDir)
    const functionToTrigger = await getNameFromArgs(functions, args, flags)

    let headers = {}
    let body = {}

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'functions:invoke'
      }
    })

    if (eventTriggeredFunctions.includes(functionToTrigger)) {
      /** handle event triggered fns  */
      // https://www.netlify.com/docs/functions/#event-triggered-functions
      const parts = functionToTrigger.split('-')
      if (parts[0] === 'identity') {
        // https://www.netlify.com/docs/functions/#identity-event-functions
        body.event = parts[1]
        body.user = {
          email: 'foo@trust-this-company.com',
          user_metadata: {
            TODO: 'mock our netlify identity user data better'
          }
        }
      } else {
        // non identity functions seem to have a different shape
        // https://www.netlify.com/docs/functions/#event-function-payloads
        body.payload = {
          TODO: 'mock up payload data better'
        }
        body.site = {
          TODO: 'mock up site data better'
        }
      }
    } else {
      // NOT an event triggered function, but may still want to simulate authentication locally
      let _isAuthed = false
      if (typeof flags.identity === 'undefined') {
        const { isAuthed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'isAuthed',
            message: `Invoke with emulated Netlify Identity authentication headers? (pass --identity/--no-identity to override)`,
            default: true
          }
        ])
        _isAuthed = isAuthed
      } else {
        _isAuthed = flags.identity
      }
      if (_isAuthed) {
        headers = {
          authorization:
            'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzb3VyY2UiOiJuZXRsaWZ5IGZ1bmN0aW9uczp0cmlnZ2VyIiwidGVzdERhdGEiOiJORVRMSUZZX0RFVl9MT0NBTExZX0VNVUxBVEVEX0pXVCJ9.Xb6vOFrfLUZmyUkXBbCvU4bM7q8tPilF0F03Wupap_c'
        }
        // you can decode this https://jwt.io/
        // {
        //   "source": "netlify functions:trigger",
        //   "testData": "NETLIFY_DEV_LOCALLY_EMULATED_JWT"
        // }
      }
    }
    const payload = processPayloadFromFlag(flags.payload)
    body = Object.assign({}, body, payload)

    // fetch
    fetch(
      `http://localhost:${port}/.netlify/functions/${functionToTrigger}` + formatQstring(flags.querystring),
      {
        method: 'post',
        headers,
        body: JSON.stringify(body)
      }
    )
      .then(response => {
        let data
        data = response.text()
        try {
          // data = response.json();
          data = JSON.parse(data)
          // eslint-disable-next-line no-empty
        } catch (err) {}
        return data
      })
      .then(console.log)
      .catch(err => {
        console.error('ran into an error invoking your function')
        console.error(err)
      })
  }
}

function formatQstring(querystring) {
  if (querystring) {
    return '?' + querystring
  } else {
    return ''
  }
}

/** process payloads from flag */
function processPayloadFromFlag(payloadString) {
  if (payloadString) {
    // case 1: jsonstring
    let payload = tryParseJSON(payloadString)
    if (payload) return payload
    // case 2: jsonpath
    const payloadpath = path.join(process.cwd(), payloadString)
    const pathexists = fs.existsSync(payloadpath)
    if (pathexists) {
      try {
        payload = require(payloadpath) // there is code execution potential here
        return payload
      } catch (err) {
        console.error(err)
      }
    }
    // case 3: invalid string, invalid path
    return false
  }
}

// prompt for a name if name not supplied
// also used in functions:create
async function getNameFromArgs(functions, args, flags) {
  // let functionToTrigger = flags.name;
  // const isValidFn = Object.keys(functions).includes(functionToTrigger);
  if (flags.name && args.name) {
    console.error('function name specified in both flag and arg format, pick one')
    process.exit(1)
  }
  let functionToTrigger
  if (flags.name && !args.name) functionToTrigger = flags.name
  // use flag if exists
  else if (!flags.name && args.name) functionToTrigger = args.name

  const isValidFn = Object.keys(functions).includes(functionToTrigger)
  if (!functionToTrigger || !isValidFn) {
    if (functionToTrigger && !isValidFn) {
      console.warn(
        `Function name ${chalk.yellow(
          functionToTrigger
        )} supplied but no matching function found in your functions folder, forcing you to pick a valid one...`
      )
    }
    const { trigger } = await inquirer.prompt([
      {
        type: 'list',
        message: 'Pick a function to trigger',
        name: 'trigger',
        choices: Object.keys(functions)
      }
    ])
    functionToTrigger = trigger
  }

  return functionToTrigger
}

FunctionsInvokeCommand.description = `Trigger a function while in netlify dev with simulated data, good for testing function calls including Netlify's Event Triggered Functions`
FunctionsInvokeCommand.aliases = ['function:trigger']

FunctionsInvokeCommand.examples = [
  '$ netlify functions:invoke',
  '$ netlify functions:invoke myfunction',
  '$ netlify functions:invoke --name myfunction',
  '$ netlify functions:invoke --name myfunction --identity',
  '$ netlify functions:invoke --name myfunction --no-identity',
  '$ netlify functions:invoke myfunction --payload "{"foo": 1}"',
  '$ netlify functions:invoke myfunction --querystring "foo=1',
  '$ netlify functions:invoke myfunction --payload "./pathTo.json"'
]
FunctionsInvokeCommand.args = [
  {
    name: 'name',
    description: 'function name to invoke'
  }
]

FunctionsInvokeCommand.flags = {
  name: flags.string({
    char: 'n',
    description: 'function name to invoke'
  }),
  functions: flags.string({
    char: 'f',
    description: 'Specify a functions folder to parse, overriding netlify.toml'
  }),
  querystring: flags.string({
    char: 'q',
    description: 'Querystring to add to your function invocation'
  }),
  payload: flags.string({
    char: 'p',
    description: 'Supply POST payload in stringified json, or a path to a json file'
  }),
  identity: flags.boolean({
    description: 'simulate Netlify Identity authentication JWT. pass --no-identity to affirm unauthenticated request',
    allowNo: true
  }),
  port: flags.integer({
    description: 'Port where netlify dev is accessible. e.g. 8888',
  })
}

module.exports = FunctionsInvokeCommand

// https://stackoverflow.com/questions/3710204/how-to-check-if-a-string-is-a-valid-json-string-in-javascript-without-using-try
function tryParseJSON(jsonString) {
  try {
    var o = JSON.parse(jsonString)

    // Handle non-exception-throwing cases:
    // Neither JSON.parse(false) or JSON.parse(1234) throw errors, hence the type-checking,
    // but... JSON.parse(null) returns null, and typeof null === "object",
    // so we must check for that, too. Thankfully, null is falsey, so this suffices:
    if (o && typeof o === 'object') {
      return o
    }
    // eslint-disable-next-line no-empty
  } catch (e) {}

  return false
}
