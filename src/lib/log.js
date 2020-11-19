const chalk = require('chalk')
const dotProp = require('dot-prop')

const RED_BACKGROUND = chalk.red('-background')
const [PRO, BUSINESS, ENTERPRISE] = ['Pro', 'Business', 'Enterprise'].map((plan) => chalk.magenta(plan))
const BACKGROUND_FUNCTIONS_WARNING = `A serverless function ending in \`${RED_BACKGROUND}\` was detected.
Your team’s current plan doesn’t support Background Functions, which have names ending in \`${RED_BACKGROUND}\`.
To be able to deploy this function successfully either:
  - change the function name to remove \`${RED_BACKGROUND}\` and execute it synchronously
  - upgrade your team plan to a level that supports Background Functions (${PRO}, ${BUSINESS}, or ${ENTERPRISE})
`

const messages = {
  functions: {
    backgroundNotSupported: BACKGROUND_FUNCTIONS_WARNING,
  },
}

const getLogMessage = (key) => dotProp.get(messages, key, 'Missing Log Message Key')

module.exports = {
  getLogMessage,
}
